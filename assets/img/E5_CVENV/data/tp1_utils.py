"""Given functions for TP1. Nothing to complete here: your work goes in the notebook.

From the notebook, show_source(show) prints one function and show_source() prints the whole file.
"""
import inspect
import os
import shutil
import sys
import urllib.request
import zipfile

import matplotlib.pyplot as plt
import numpy as np
import rasterio
from matplotlib.colors import ListedColormap
from rasterio import warp, windows
from rasterio.enums import Resampling
from rasterio.transform import array_bounds

__version__ = "2026.5"

CAMERA_TRAP_URL = "https://raw.githubusercontent.com/agentmorris/MegaDetector/main/images/"
STAC_URL = "https://earth-search.aws.element84.com/v1"              # Sentinel-2 catalogue
PC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"      # Sentinel-1 catalogue
DATA_URL = None                                                     # course website, set by setup()

BANDS = ["blue", "green", "red", "nir"]
SCL_CLASSES = {0: "no data", 1: "saturated / defective", 2: "cast shadows", 3: "cloud shadows", 4: "vegetation",
               5: "not vegetated", 6: "water", 7: "unclassified", 8: "cloud, medium prob.",
               9: "cloud, high prob.", 10: "thin cirrus", 11: "snow / ice"}
SCL_COLOURS = ListedColormap(plt.cm.tab20.colors[:12])              # one colour per class


# ---------- Setup and files ----------

def setup(data_url):
    """Prepare the plots and the remote reads. Returns True if the Sentinel-2 catalogue answers."""
    global DATA_URL
    DATA_URL = data_url
    plt.rcParams["figure.dpi"] = 100
    plt.rcParams["image.interpolation"] = "nearest"
    # settings of GDAL, the library that rasterio uses to read remote files
    os.environ["GDAL_DISABLE_READDIR_ON_OPEN"] = "EMPTY_DIR"
    os.environ["AWS_NO_SIGN_REQUEST"] = "YES"
    os.environ["GDAL_HTTP_MAX_RETRY"] = "3"
    os.environ["GDAL_HTTP_RETRY_DELAY"] = "1"
    try:
        urllib.request.urlopen(STAC_URL, timeout=10).close()
        print("Internet OK")
        return True
    except Exception as error:
        print("No internet access:", error)
        print("On Kaggle: Settings -> Internet -> On (needs a phone-verified account). Otherwise use Colab.")
        print("The cells that query a catalogue will fail; the cells after them load the course copies.")
        return False


def get_file(name, url=None):
    """Path of the file `name`: already here, or downloaded from `url`, or from the course website."""
    if os.path.exists(name):
        return name
    sources = []
    if url is not None:
        sources.append(url)
    if DATA_URL is not None:
        sources.append(DATA_URL + name)
    for source in sources:
        try:
            with urllib.request.urlopen(source, timeout=60) as response, open(name + ".part", "wb") as f:
                shutil.copyfileobj(response, f)
            if name.endswith(".npz") and not zipfile.is_zipfile(name + ".part"):
                raise ValueError("this is not an .npz file")
            os.replace(name + ".part", name)
            return name
        except Exception as error:
            print(f"could not download {source}: {error}")
    raise FileNotFoundError(f"{name} could not be downloaded: check the internet access "
                            "(Kaggle: Settings -> Internet -> On)")


def load_npz(name):
    """Load a course .npz file as a dictionary of arrays."""
    with np.load(get_file(name)) as f:
        return {key: f[key] for key in f.files}


def crop_to_grid(data, like=None):
    """Cut a course copy (stored a little larger than needed) to the pixels of the window `like`.

    Without `like`, cut it to the reference window around ESIEE.
    """
    # transform = [pixel size, 0, x of the left edge, 0, -pixel size, y of the top edge], in metres
    pixel, _, left, _, _, top = np.asarray(data["transform"], dtype=float)[:6]
    if like is None:
        row, col, height, width = [int(v) for v in data["core"]]
    else:
        height, width = like["red"].shape
        col = int(round((like["transform"][2] - left) / pixel))
        row = int(round((top - like["transform"][5]) / pixel))

    out = {}
    for key, value in data.items():
        if np.ndim(value) == 2:                                   # an image: keep the window
            if row < 0 or col < 0 or row + height > value.shape[0] or col + width > value.shape[1]:
                raise ValueError("your window does not fit inside the course copy: "
                                 "check ESIEE and bbox_around in Part 2.1, then rerun from there")
            out[key] = value[row:row + height, col:col + width]
        elif key != "core":
            out[key] = value
    out["transform"] = np.array([pixel, 0, left + col * pixel, 0, -pixel, top - row * pixel])
    return out


def show_source(function=None):
    """Print the code of a function of this file, or of the whole file."""
    from IPython.display import Code, display
    if function is None:
        function = sys.modules[__name__]
    display(Code(inspect.getsource(function), language="python"))


# ---------- Display ----------

def show(images, titles=None, cmap="gray", height=4, ncols=None, **kwargs):
    """Show images side by side, in rows of `ncols`. The other arguments go to plt.imshow (vmin, vmax...)."""
    if ncols is None:
        ncols = len(images)
    nrows = int(np.ceil(len(images) / ncols))
    fig, axes = plt.subplots(nrows, ncols, figsize=(height * 1.6 * ncols, height * nrows), squeeze=False)
    for ax in axes.ravel():
        ax.axis("off")
    for i, image in enumerate(images):
        ax = axes.ravel()[i]
        im = ax.imshow(image, cmap=cmap, **kwargs)
        if titles is not None:
            ax.set_title(titles[i])
        if np.ndim(image) == 2:                                   # one channel: add the colour scale
            fig.colorbar(im, ax=ax, shrink=0.8)
    plt.tight_layout()
    plt.show()


def show_threshold(index, background, threshold, name="index"):
    """Show an index map, its histogram, and the pixels above `threshold` in magenta over `background`."""
    mask = index > threshold
    painted = np.array(background)
    painted[mask] = (1, 0, 1)                                     # magenta
    fig, axes = plt.subplots(1, 3, figsize=(17, 4.2), width_ratios=[1.25, 0.8, 1.1])

    im = axes[0].imshow(index, cmap="RdYlGn", vmin=-1, vmax=1)
    fig.colorbar(im, ax=axes[0], shrink=0.8)
    axes[0].set_title(name)
    axes[0].axis("off")

    axes[1].hist(index.ravel(), bins=200, range=(-1, 1), color="gray")
    axes[1].axvline(threshold, color="magenta", linewidth=2)
    axes[1].set_title(f"histogram of {name}, threshold = {threshold:.2f}")
    axes[1].set_xlabel(name)
    axes[1].set_ylabel("number of pixels")

    axes[2].imshow(painted)
    axes[2].set_title(f"{name} > {threshold:.2f}: {100 * mask.mean():.1f} % of the image")
    axes[2].axis("off")
    plt.tight_layout()
    plt.show()


def threshold_app(index, background, name="index", start=0.0):
    """show_threshold with a slider for the threshold. Without ipywidgets: one figure, for `start`."""
    def draw(threshold):
        show_threshold(index, background, threshold, name)

    try:
        import ipywidgets
    except ImportError:
        draw(start)
        return
    slider = ipywidgets.FloatSlider(value=start, min=-1, max=1, step=0.05, description="threshold",
                                    continuous_update=False, layout={"width": "60%"})
    ipywidgets.interact(draw, threshold=slider)


def draw_matches(image1, points1, image2, points2, inliers=None, max_lines=150, title=""):
    """Show two images side by side, with one line per pair of matched points (x, y).

    With `inliers` (one boolean per match), the inliers are green and the other matches red.
    """
    points1 = np.reshape(points1, (-1, 2))
    points2 = np.reshape(points2, (-1, 2))
    if inliers is None:
        inliers = np.ones(len(points1), dtype=bool)
    inliers = np.ravel(inliers).astype(bool)

    # one canvas holding both images; grayscale images get a third axis so that they fit in it
    if image1.ndim == 2:
        image1 = image1[:, :, None]
    if image2.ndim == 2:
        image2 = image2[:, :, None]
    width1 = image1.shape[1]
    canvas = np.zeros((max(image1.shape[0], image2.shape[0]), width1 + image2.shape[1], 3), dtype=np.uint8)
    canvas[:image1.shape[0], :width1] = image1
    canvas[:image2.shape[0], width1:] = image2

    plt.figure(figsize=(16, 6))
    plt.imshow(canvas)
    drawn = np.random.default_rng(0).permutation(len(points1))[:max_lines]      # a random subset of the matches
    for i in drawn:
        x1, y1 = points1[i]
        x2, y2 = points2[i]
        plt.plot([x1, x2 + width1], [y1, y2], color="lime" if inliers[i] else "red", linewidth=0.7)
    plt.title(title or f"{len(points1)} matches ({len(drawn)} drawn)")
    plt.axis("off")
    plt.show()


# ---------- Map coordinates ----------

def lonlat_to_rowcol(lon, lat, transform, crs):
    """Pixel (row, column) of a longitude/latitude point in an image with this transform and CRS."""
    xs, ys = warp.transform("EPSG:4326", str(crs), [lon], [lat])            # degrees -> metres of the image
    pixel, _, left, _, _, top = np.asarray(transform, dtype=float)[:6]
    row = int((top - ys[0]) // pixel)
    col = int((xs[0] - left) // pixel)
    return row, col


def check_location(lon, lat, tolerance_m=300):
    """Check that (lon, lat) is ESIEE Paris, within `tolerance_m` metres."""
    if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
        raise TypeError("ESIEE must be two numbers: (longitude, latitude) in decimal degrees")
    if 40 < lon < 55 and -5 < lat < 10:
        raise ValueError(f"({lon}, {lat}) looks like (latitude, longitude): we need (longitude, latitude)")
    ref_lon, ref_lat = load_npz("tp1_checks.npz")["esiee_lonlat"]
    xs, ys = warp.transform("EPSG:4326", "EPSG:32631", [lon, ref_lon], [lat, ref_lat])      # degrees -> metres
    distance = np.hypot(xs[0] - xs[1], ys[0] - ys[1])
    if distance > tolerance_m:
        raise ValueError(f"({lon}, {lat}) is {distance / 1000:.2f} km from ESIEE Paris: check the address "
                         "(2 boulevard Blaise Pascal, Noisy-le-Grand) and the number of decimals")
    print(f"ESIEE located: {distance:.0f} m from the course reference point (distance computed in UTM metres)")


# ---------- Sentinel-2 ----------

def read_crop(href, bbox):
    """Read the part of one band (a remote image file) inside bbox = [west, south, east, north], in degrees.

    Only these pixels are downloaded. Returns the array and the transform of the window.
    """
    with rasterio.open(href) as src:
        bounds = warp.transform_bounds("EPSG:4326", src.crs, *bbox)         # the box in the coordinates of the image
        window = windows.from_bounds(*bounds, transform=src.transform)      # the pixel window that covers it
        window = window.round_offsets().round_lengths()                     # whole pixels
        return src.read(1, window=window), src.window_transform(window)


def load_sentinel2(item, bbox, bands=BANDS):
    """Read the window `bbox` of one Sentinel-2 catalogue item: the bands, the SCL classes and the metadata."""
    data = {}
    for band in bands:
        data[band], transform = read_crop(item.assets[band].href, bbox)
    height, width = data["red"].shape

    # the SCL has 20 m pixels: read the same ground area and repeat each class to get the same 10 m grid
    with rasterio.open(item.assets["scl"].href) as src:
        bounds = array_bounds(height, width, transform)
        window = windows.from_bounds(*bounds, transform=src.transform)
        data["scl"] = src.read(1, window=window, out_shape=(height, width), resampling=Resampling.nearest)

    with rasterio.open(item.assets["red"].href) as src:
        data["crs"] = src.crs.to_string()
    metadata = item.assets["red"].extra_fields["raster:bands"][0]
    data["scale"] = metadata["scale"]
    data["offset"] = metadata["offset"]
    data["transform"] = np.array(transform)[:6]
    data["item_id"] = item.id
    data["datetime"] = item.datetime.isoformat()
    return data
