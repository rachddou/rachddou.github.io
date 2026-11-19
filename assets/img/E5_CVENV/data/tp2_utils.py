"""Given functions for TP2. Nothing to complete here: your work goes in the notebook.

From the notebook, show_source(show_examples) prints one function and show_source() prints the whole file.
"""
import inspect
import os
import shutil
import sys
import urllib.request
import zipfile

import matplotlib.pyplot as plt
import numpy as np
import torch
from sklearn.metrics import ConfusionMatrixDisplay

__version__ = "2026.5"

_data_url = None          # course website, set by setup(); "_" so that `from tp2_utils import *` does not overwrite
                          # the DATA_URL of the notebook


# ---------- Setup and files ----------

def setup(data_url):
    """Prepare the plots, fix the random seeds and return the device: 'cuda' (GPU) if there is one, else 'cpu'."""
    global _data_url
    _data_url = data_url
    plt.rcParams["figure.dpi"] = 100
    plt.rcParams["image.interpolation"] = "nearest"
    torch.manual_seed(0)
    np.random.seed(0)
    if torch.cuda.is_available():
        device = "cuda"
        print("GPU found:", torch.cuda.get_device_name(0))
    elif torch.backends.mps.is_available():
        device = "mps"
        print("Apple GPU found (mps)")
    else:
        device = "cpu"
        print("No GPU: everything runs on the CPU, the training cells are much slower (more than ten minutes each).")
    return device


def get_file(name):
    """Path of the file `name`: already here, or downloaded from the course website."""
    if os.path.exists(name):
        return name
    source = _data_url + name
    try:
        with urllib.request.urlopen(source, timeout=120) as response, open(name + ".part", "wb") as f:
            shutil.copyfileobj(response, f)
        if name.endswith(".npz") and not zipfile.is_zipfile(name + ".part"):
            raise ValueError("this is not an .npz file")
        os.replace(name + ".part", name)
        return name
    except Exception as error:
        raise FileNotFoundError(f"could not download {source} ({error}): check the internet access "
                                "(Kaggle: Settings -> Internet -> On)") from None


def load_eurosat():
    """Load the course subset of EuroSAT: a dictionary of NumPy arrays (x_train, y_train, ..., classes)."""
    with np.load(get_file("tp2_eurosat.npz")) as f:
        data = {}
        for key in f.files:
            data[key] = f[key]
    data["classes"] = [str(name) for name in data["classes"]]
    return data


def load_extra_bands():
    """Bands B8 and B11 of the same patches (EuroSAT-MS): x_train, x_val, x_test as (N, 64, 64, 2) uint16 arrays
    of reflectance x 10,000, and `bands`, the names of the two bands."""
    with np.load(get_file("tp2_eurosat_b8_b11.npz")) as f:
        extra = {}
        for key in f.files:
            extra[key] = f[key]
    extra["bands"] = [str(name) for name in extra["bands"]]
    return extra


def show_source(function=None):
    """Print the code of a function of this file, or of the whole file."""
    from IPython.display import Code, display
    if function is None:
        function = sys.modules[__name__]
    display(Code(inspect.getsource(function), language="python"))


# ---------- Display ----------

def show_examples(images, labels, classes, per_class=4):
    """Show `per_class` images of each class, one column per class. `images` is (N, H, W, 3) uint8."""
    fig, axes = plt.subplots(per_class, len(classes), figsize=(1.5 * len(classes), 1.5 * per_class),
                             squeeze=False)
    for c, name in enumerate(classes):
        where = np.flatnonzero(labels == c)
        for row in range(per_class):
            ax = axes[row, c]
            ax.imshow(images[where[row]])
            ax.axis("off")
        axes[0, c].set_title(name, fontsize=8)
    plt.tight_layout()
    plt.show()


def show_maps(maps, titles=None, ncols=8, size=1.8):
    """Show a list of 2-D arrays (feature maps) side by side, each with its own grey scale."""
    nrows = int(np.ceil(len(maps) / ncols))
    fig, axes = plt.subplots(nrows, ncols, figsize=(size * ncols, size * nrows), squeeze=False)
    for ax in axes.ravel():
        ax.axis("off")
    for i in range(len(maps)):
        ax = axes.ravel()[i]
        ax.imshow(maps[i], cmap="gray")
        if titles is not None:
            ax.set_title(titles[i], fontsize=8)
    plt.tight_layout()
    plt.show()


def show_images(images, titles=None, size=1.8):
    """Show a list of (3, H, W) tensors with values in [0, 1] side by side."""
    fig, axes = plt.subplots(1, len(images), figsize=(size * len(images), size + 0.3), squeeze=False)
    for i, ax in enumerate(axes[0]):
        ax.imshow(images[i].permute(1, 2, 0).clamp(0, 1).numpy())
        ax.axis("off")
        if titles is not None:
            ax.set_title(titles[i], fontsize=8)
    plt.tight_layout()
    plt.show()


def show_prediction(image, probabilities, classes, label):
    """Show an (H, W, 3) uint8 image and the probability given to each class (true class in orange)."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9, 3), gridspec_kw={"width_ratios": [1, 2.5]})
    ax1.imshow(image)
    ax1.set_title(f"true class: {classes[label]}", fontsize=9)
    ax1.axis("off")
    colors = ["tab:orange" if c == label else "tab:blue" for c in range(len(classes))]
    ax2.bar(np.arange(len(classes)), np.asarray(probabilities), color=colors)
    ax2.set_xticks(np.arange(len(classes)))
    ax2.set_xticklabels(classes, rotation=60, ha="right", fontsize=8)
    ax2.set_ylabel("probability (softmax)")
    ax2.set_ylim(0, 1)
    plt.tight_layout()
    plt.show()


def plot_history(history, title=""):
    """Plot the loss and the accuracy per epoch, for the training set and the validation set."""
    epochs = np.arange(1, len(history["train_loss"]) + 1)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 3.2))
    ax1.plot(epochs, history["train_loss"], "o-", label="training")
    ax1.plot(epochs, history["val_loss"], "o-", label="validation")
    ax1.set_xlabel("epoch")
    ax1.set_ylabel("cross-entropy loss")
    ax1.legend()
    ax2.plot(epochs, history["train_acc"], "o-", label="training")
    ax2.plot(epochs, history["val_acc"], "o-", label="validation")
    ax2.set_xlabel("epoch")
    ax2.set_ylabel("accuracy")
    ax2.set_ylim(0, 1)
    ax2.legend()
    fig.suptitle(title)
    plt.tight_layout()
    plt.show()


def show_confusion(y_true, y_pred, classes):
    """Confusion matrix: one row per true class, one column per predicted class."""
    fig, ax = plt.subplots(figsize=(7, 6))
    ConfusionMatrixDisplay.from_predictions(y_true, y_pred, display_labels=classes, cmap="Blues",
                                            xticks_rotation=90, colorbar=False, ax=ax)
    ax.set_xlabel("predicted class")
    ax.set_ylabel("true class")
    plt.tight_layout()
    plt.show()


def show_errors(images, y_true, y_pred, classes, n=12):
    """Show `n` misclassified images, spread over the whole set, with their true and predicted class."""
    wrong = np.flatnonzero(y_true != y_pred)
    if len(wrong) > n:
        picked = np.linspace(0, len(wrong) - 1, n).astype(int)    # n positions spread over the errors
        wrong = wrong[picked]
    fig, axes = plt.subplots(2, int(np.ceil(n / 2)), figsize=(1.9 * n / 2, 4.6), squeeze=False)
    for ax in axes.ravel():
        ax.axis("off")
    for i in range(len(wrong)):
        k = wrong[i]
        ax = axes.ravel()[i]
        ax.imshow(images[k])
        ax.set_title(f"true: {classes[y_true[k]]}\npred: {classes[y_pred[k]]}", fontsize=7)
    plt.tight_layout()
    plt.show()


# ---------- Evaluation ----------

def evaluate(model, loader, device):
    """Mean loss and accuracy of `model` on all the batches of `loader`."""
    loss_function = torch.nn.CrossEntropyLoss(reduction="sum")
    model.eval()                                                    # evaluation mode (no dropout...)
    total_loss = 0.0
    correct = 0
    count = 0
    with torch.no_grad():                                           # no gradient needed here
        for x, y in loader:
            x = x.to(device)
            y = y.to(device)
            scores = model(x)
            total_loss += loss_function(scores, y).item()
            correct += (scores.argmax(dim=1) == y).sum().item()
            count += len(y)
    return total_loss / count, correct / count


def predict(model, loader, device):
    """Predicted class of every image of `loader`, as a NumPy array."""
    model.eval()
    predictions = []
    with torch.no_grad():
        for x, y in loader:
            scores = model(x.to(device))
            predictions.append(scores.argmax(dim=1).cpu().numpy())
    return np.concatenate(predictions)
