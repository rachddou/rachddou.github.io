---
layout: page
title: TP E2 — Matrices en C et efficacité mémoire
description: Représenter, transposer et multiplier des matrices en C, en optimisant les accès mémoire étape par étape.
---

*Deuxième TP du cours Programmation en C et Efficacité Énergétique (E2)*

## Préambule

### Contexte

Les matrices sont omniprésentes en calcul scientifique et en intelligence artificielle. Ce TP vous amène à les manipuler en C de façon progressive : déclaration, affichage, transposition, multiplication. À chaque étape, vous mesurerez les performances et observerez l'impact des choix d'implémentation sur l'efficacité énergétique du programme.

### Objectifs

* Savoir déclarer et manipuler des matrices en C
* Comprendre la hiérarchie mémoire du processeur et son impact sur les performances
* Appliquer des optimisations concrètes : accès contigus, tiling
* Maîtriser la compilation séparée avec fichiers d'en-tête (rappel TP C1)

### Mise en place du TP

```bash
mkdir Documents/EE_PC/TP_E2/
cd Documents/EE_PC/TP_E2/
```

Rappel de la commande de compilation `mycc` (TP C1, §2.B) :

```bash
mycc() { echo gcc: ; gcc "$@" -std=c99 -Wall -Wextra -lm ; echo Done. ;}
```

**Conservez tous les programmes C écrits au fur et à mesure.**

### Mesure du temps

Pour mesurer les temps d'exécution, vous utiliserez la fonction suivante dans tous les exercices. Elle utilise `clock_gettime` de la bibliothèque `<time.h>` et retourne le temps courant en secondes avec une résolution nanoseconde :

```c
#include <time.h>

double tempsSecondes() {
    struct timespec vTs;
    clock_gettime( CLOCK_MONOTONIC, &vTs );
    return vTs.tv_sec + vTs.tv_nsec * 1e-9;
}
```

Usage :

```c
double vDebut = tempsSecondes();
/* ... code à mesurer ... */
double vFin   = tempsSecondes();
printf( "Temps : %.4f s\n", vFin - vDebut );
```

---

## Partie 1 — Représentation et manipulation de matrices en C

### I. Déclaration de matrices globales

#### Tableaux bidimensionnels

En C, une matrice peut être déclarée comme un **tableau à deux dimensions** :

```c
double vA[3][3];   /* matrice 3x3 de réels */
```

L'accès à l'élément à la ligne `vI` et à la colonne `vJ` s'écrit naturellement `vA[vI][vJ]`.

#### Pourquoi des variables globales ?

Pour de grandes matrices (par exemple $1024 \times 1024$, soit $8$ Mo par matrice de `double`), on ne peut pas déclarer le tableau comme variable locale dans `main` : la **pile** (*stack*) est limitée à quelques Mo, et un tel tableau provoquerait un *segmentation fault* au démarrage.

On utilise à la place des **variables globales**, déclarées en dehors de toute fonction. Elles sont stockées dans le **segment de données** du programme, dont la taille n'est pas bornée par ce mécanisme.

*Note : dans la suite du cours (TP C4), vous verrez comment utiliser l'allocation dynamique sur le **tas** (`malloc`) pour réserver de la mémoire à l'exécution de façon flexible. Pour ce TP, les variables globales suffisent.*

```c
#define NMAX 1024

double vA[NMAX][NMAX];   /* 8 Mo */
double vB[NMAX][NMAX];   /* 8 Mo */
double vC[NMAX][NMAX];   /* 8 Mo */
```

Les tableaux globaux sont automatiquement **initialisés à zéro** au démarrage du programme.

#### Équivalence tableau 2D / tableau 1D et organisation mémoire

En mémoire, un tableau bidimensionnel `vA[NMAX][NMAX]` est stocké de façon **contiguë, ligne par ligne** (convention dite **row-major** du C) :

```
Matrice 3x3 :          En mémoire (adresses croissantes) :
[ A[0][0]  A[0][1]  A[0][2] ]   →  A[0][0]  A[0][1]  A[0][2]  A[1][0]  A[1][1]  ...
[ A[1][0]  A[1][1]  A[1][2] ]       ↑ ligne 0 ↑                ↑ ligne 1 ↑
[ A[2][0]  A[2][1]  A[2][2] ]
```

Ainsi, `vA[vI][vJ]` est à la même adresse que l'élément `vI*N + vJ` d'un tableau 1D équivalent. Cette organisation a une conséquence directe : **parcourir une ligne** (faire varier `vJ` pour `vI` fixé) revient à lire des cases mémoire consécutives → accès **contigu**, très efficace. À l'inverse, **parcourir une colonne** (faire varier `vI` pour `vJ` fixé) revient à sauter de `N` éléments à chaque accès → accès **non contigu**, beaucoup plus lent.

Nous verrons dans la Partie 2 en quoi cela est crucial pour les performances.

### Exercice 1 — Fonctions utilitaires et compilation séparée

L'objectif de cet exercice est de créer un fichier `1A_fonctions.c` contenant les procédures utilitaires, ainsi qu'un fichier d'en-tête `1A.h` contenant leurs prototypes. Ces fichiers seront **réutilisés** dans les exercices suivants via la **compilation séparée** (rappel TP C1, §11).

**1.A.** Créer un nouveau fichier `1A_fonctions.c`, dans lequel vous définirez toutes les fonctions utilitaires.  

**Écrire** la fonction `tempsSecondes` présentée dans le Préambule.

**1.B.** **Écrire** la **procédure** `initAleatoire` qui prend un tableau `double pM[][NMAX]` et un entier `pN`, et remplit les `pN × pN` cases avec des valeurs réelles aléatoires entre 0 et 1. Pour se faciliter la vie, on définira `NMAX` comme une constante.

{% details Rappel : nombre aléatoire entre 0 et 1 %}
```c
#include <stdlib.h>
/* Dans le main, initialiser le générateur une seule fois : */
srand(42);
/* Puis, pour obtenir un réel entre 0 et 1 : */
double vVal = (double)rand() / RAND_MAX;
```
Le paramètre de `srand` est la **graine** (*seed*). Une graine fixe garantit la **reproductibilité** des résultats d'un TP à l'autre.
{% enddetails %}

**1.C.** **Écrire** la **procédure** `initZeros` qui remet à zéro toutes les cases de `pM` (taille `pN × pN`).

*Pourquoi en a-t-on besoin si les globaux sont déjà à zéro ?* Parce qu'on exécutera plusieurs mesures à la suite sur les mêmes tableaux globaux, et il faudra réinitialiser les résultats entre deux mesures.

**1.D.** **Écrire** la **procédure** `affMatrice` qui prend `double pM[NMAX][NMAX]`, un entier `pN` et un nom `char * pNom`, et affiche la matrice sous la forme suivante (en utilisant `\t` pour aligner les colonnes), y compris si certaines valeurs sont négatives :

```
Matrice A (4x4) :
  0.37	 -0.95	  0.73	  0.60
 -0.16	  0.06	  0.87	 -0.02
  0.40	  0.53	 -0.89	  0.11
  0.70	 -0.21	  0.97	  0.83
```

**Attention !** Pour `pN > 4`, n'afficher que les 4 premières lignes et colonnes, suivies de `"..."`. Si vous ne vous souvenez plus des formats d'affichages, rendez vous sur les pages des TPs C1 et C2.

<!-- {% details Rappel : affichage d'un réel avec deux décimales et d'une chaîne %}
Le format `%.2f` affiche un `double` avec 2 décimales. Le format `%7.2f` fixe une largeur minimale (utile pour garder les colonnes alignées avec des valeurs négatives). Le format `%s` affiche une chaîne de caractères `char *` (revu au TP C2, §IV). La tabulation s'insère avec le caractère spécial `\t`.
{% enddetails %} -->

**1.E.** Créer le fichier d'en-tête `1A.h` contenant :
- la directive de définition de NMAX
- les **prototypes** des quatre fonctions écrites ci-dessus (comme au TP C1, §11)
La présentation des fichiers d'en-tête a été faite dans le TP C1.

<!-- {% details Rappel : contenu d'un fichier .h %}
Un fichier d'en-tête contient uniquement les **déclarations** (prototypes), pas le corps des fonctions. Par exemple :
```c
#define NMAX 1024
double tempsSecondes();
void   initAleatoire( double pM[][NMAX], int pN );
```
Pour l'inclure depuis un autre fichier du même répertoire, on utilise (TP C1, §11.B) :
```c
#include "1A.h"
```
{% enddetails %} -->

**1.F.** Écrire un `main` (dans `1A_fonctions.c`) qui teste les quatre procédures avec `vN = 4`, puis avec `vN = 10` pour vérifier l'affichage tronqué.

Compilez et testez le fichier `1A_fonctions.c`.

<!-- ```bash
mycc 1A_fonctions.c -o 1A.exe
./1A.exe
``` -->

**Rappel compilation séparée (TP C1, §11) :** pour les exercices suivants, `1A_fonctions.c` sera compilé séparément et lié à chaque fichier exercice :

```bash
mycc -c 1A_fonctions.c          # produit 1A_fonctions.o
mycc -c 2A_transposition.c 
mycc 2A_transposition.o 1A_fonctions.o -o 2A.exe
```

---

## Partie 2 — Transposition de matrice

### II. Hiérarchie mémoire et localité des accès

Avant d'implémenter la transposition, voici une description de l'organisation de la mémoire locale du processeur, essentielle pour comprendre les performances :

| Niveau    | Taille typique | Latence typique | Description                                    |
|-----------|----------------|-----------------|------------------------------------------------|
| Registres | < 1 Ko         | ~1 cycle        | Intégrés dans le cœur du CPU, ultra-rapides    |
| Cache L1  | 32 – 64 Ko     | ~4 cycles       | Cache de données du cœur, très rapide          |
| Cache L2  | 256 Ko – 1 Mo  | ~12 cycles      | Cache unifié (données + instructions)           |
| Cache L3  | 4 – 32 Mo      | ~40 cycles      | Partagé entre tous les cœurs                   |
| RAM       | Plusieurs Go   | ~200 cycles     | Mémoire principale, lente                      |

Le processeur charge la mémoire par blocs de **64 octets** appelés **lignes de cache** (soit 8 `double`). Lorsqu'on accède à une case mémoire, les 7 voisines sont chargées automatiquement dans le cache L1. Si l'accès suivant se trouve dans la même ligne de cache (accès **contigu**), aucun nouvel accès RAM n'est nécessaire. En revanche, si l'accès suivant est dans une ligne différente (**défaut de cache**, *cache miss*), le processeur doit attendre ~200 cycles pour charger la nouvelle ligne depuis la RAM — un coût considérable.

**Pour connaître les tailles de cache de votre machine :**

```bash
lscpu | grep cache
```

### Exercice 2 — Transposition naïve

Créez un fichier `2A_transposition.c`. Ajoutez en variables globales :

```c
#include "1A.h"

double vA[NMAX][NMAX];
double vAt[NMAX][NMAX];   /* contiendra la transposée de vA */
```

**2.A.** **Écrire** la **procédure** `transposerNaive` qui calcule la transposée de `vA` dans `vAt`.

<!-- $$
\text{vAt}[i][j] = \text{vA}[j][i] \quad \text{pour tout } i, j
$$ -->

<!-- {% details Indice : structure de la procédure %}
Deux boucles `for` imbriquées sur `vI` et `vJ` suffisent. L'élément à la ligne `vI`, colonne `vJ` de `vA` devient l'élément à la ligne `vJ`, colonne `vI` de `vAt`.
{% enddetails %} -->

**2.B.** Écrire le `main` qui mesure le temps de `transposerNaive` pour `vN` $\in \{128, 256, 512, 1024\}$. Pour chaque valeur de `vN`, **répétez l'opération 10 fois et moyennez** les temps obtenus afin d'obtenir une mesure stable, indépendante des comportements aléatoires du CPU (interruptions système, variations de fréquence, etc.). Compilez d'abord **sans optimisation** puis **avec `-O3`**.

Remplissez le tableau :

| N    | Temps `-O0` (s) | Temps `-O3` (s) | Rapport |
|------|-----------------|-----------------|---------|
| 128  |                 |                 |         |
| 256  |                 |                 |         |
| 512  |                 |                 |         |
| 1024 |                 |                 |         |

**2.C.** Que remarquez-vous sur le rapport entre `-O0` et `-O3` pour la version naïve ? Comment expliquer que le compilateur n'améliore pas (ou peu) les performances ?

{% details Explication %}
La transposition naïve est limitée non pas par le **calcul** (une simple affectation), mais par les **accès mémoire**. Pour `vJ` variant dans la boucle interne :
- `vAt[vI][vJ]` : écriture contiguë (ligne vI de vAt) ✓
- `vA[vJ][vI]`  : lecture non contiguë (colonne vI de vA) ✗ → un *cache miss* par élément

Pour $N = 1024$, la lecture de la colonne `vI` de `vA` génère 1024 *cache misses* séquentiels. Le compilateur peut appliquer `-O3`, mais il ne peut pas réorganiser les accès mémoire non contigus automatiquement → le goulot d'étranglement reste la RAM.
{% enddetails %}

### Exercice 3 — Transposition par blocs

#### Principe du tiling

Pour éviter les *cache misses* systématiques, on découpe la matrice en **blocs** de taille $B \times B$ et on transpose bloc par bloc. Si le bloc est suffisamment petit pour tenir dans le cache L1, les éléments sont chargés une seule fois et réutilisés au sein du bloc :

```
Transposition par blocs (exemple 4x4, B=2) :
Bloc (0:2, 0:2) → (0:2, 0:2) de vAt
Bloc (0:2, 2:4) → (2:4, 0:2) de vAt
...
```

Pour un cache L1 de taille $L$, la condition est que deux blocs (source et destination) tiennent en L1 :

$$
2 \times B^2 \times 8 \leq L \quad \Rightarrow \quad B \leq \frac{\sqrt{L}}{4}
$$

**3.A.** Calculez la valeur de $B$ recommandée pour votre machine à partir de `lscpu | grep L1d`.

**3.B.** Créez un fichier `3A_tiling.c`. **Écrire** la **procédure** `transposerBlocs( int pN, int pBlocs )` où `pBlocs` est la taille de bloc, qui transpose `vA` dans `vAt` bloc par bloc. On supposera que `pN` est un multiple de `pBlocs`.

{% details Indice : structure à 4 boucles %}
Deux boucles **externes** ( de pas `pBlocs`) parcourent chaques blocs de tailles $\text{pBlocs} \times \text{pBlocs}$. Deux boucles **internes** (de pas 1) effectuent la transposition à l'intérieur de chaque bloc :
<!-- ```
pour vI de 0 à pN avec pas pBlocs :
    pour vJ de 0 à pN avec pas pBlocs :
        pour vII de vI à vI+pBlocs :
            pour vJJ de vJ à vJ+pBlocs :
                vAt[vJJ][vII] = vA[vII][vJJ]
``` -->
{% enddetails %}

**3.C.** Mesurez les performances de `transposerBlocs` pour `pN = 1024` et `pBlocs` $\in \{8, 16, 32, 64\}$, **avec `-O3`**. Pour chaque configuration, **répétez l'opération 10 fois et moyennez** les temps obtenus afin d'obtenir une mesure stable, indépendante des comportements aléatoires du CPU. Comparez avec `transposerNaive` compilée avec `-O3` :

| Implémentation            | Temps `-O3` (s) | Rapport vs naïf `-O3` |
|---------------------------|-----------------|----------------------|
| `transposerNaive` `-O0`   |                 | (référence)           |
| `transposerNaive` `-O3`   |                 |                       |
| `transposerBlocs` blocs=8    |                 |                       |
| `transposerBlocs` blocs=16   |                 |                       |
| `transposerBlocs` blocs=32   |                 |                       |
| `transposerBlocs` blocs=64   |                 |                       |

**3.D.** Quel gain observez-vous avec la meilleure taille de bloc ? Correspond-il à votre calcul de la Question 3.A ?

---

## Partie 3 — Multiplication de matrices

### III. Algorithme et complexité

Le produit $C = A \times B$ de deux matrices $N \times N$ est défini par :

$$
C_{ij} = \sum_{k=0}^{N-1} A_{ik} \times B_{kj}
$$

Créez un fichier `4A_multiplication.c` incluant `"1A.h"` et déclarant les globaux :

```c
double vA[NMAX][NMAX];
double vB[NMAX][NMAX];
double vC[NMAX][NMAX];
```

### Exercice 4 — Version naïve (ordre i, j, k)

**4.A.** **Écrire** la **procédure** `multNaive( int pN )` qui calcule $C = A \times B$ avec les trois boucles dans l'ordre $i > j > k$. `vC` doit être initialisé à zéro avant l'appel.

{% details Indice %}
Traduisez directement la formule : pour chaque $(i, j)$, sommez sur $k$ les produits $A[i][k] \times B[k][j]$. 
{% enddetails %}

**4.B.** Écrire le `main` qui mesure le temps de `multNaive` pour `vN` $\in \{128, 256, 512, 1024\}$. Pour chaque valeur de `vN`, **répétez l'opération 10 fois et moyennez** les temps obtenus afin d'obtenir une mesure stable, indépendante des comportements aléatoires du CPU (interruptions système, variations de fréquence, etc.). Compilez **sans optimisation**.

<!-- ```bash
mycc 4A_multiplication.c 1A_fonctions.o -o 4A.exe
``` -->

| N    | Temps (s) |
|------|-----------|
| 128  |           |
| 256  |           |
| 512  |           |
| 1024 |           |

**4.C.** Si on double $N$, le temps d'exécution est multiplié par quel facteur ? Est-ce cohérent avec la complexité théorique en $O(N^3)$ ?

### Exercice 5 — Version optimisée (ordre i, k, j)

#### Analyse des accès mémoire dans la version naïve

Pour `vI` et `vJ` fixés, la boucle sur `vK` accède à :

```
- vA[vI][vK] : vK varie → lecture contiguë de la ligne vI de A    ✓
- vB[vK][vJ] : vK varie → lecture de la colonne vJ de B            ✗
               deux éléments consécutifs sont espacés de NMAX*8 octets
               → 1 cache miss par accès, quasiment tous les accès sont lents
```

Pour $N = 512$, lire toute la colonne `vJ` de `B` génère 512 *cache misses*. La RAM est interrogée à chaque accès au lieu d'être chargée une fois en cache.

**Solution :** en permutant les boucles sur `vJ` et `vK` (ordre $i > k > j$), la boucle interne balaie `vJ` pour `vI` et `vK` fixés :

```
- vA[vI][vK] : constante → stockable dans une variable locale (registre)  ✓
- vB[vK][vJ] : vJ varie → lecture contiguë de la ligne vK de B            ✓
- vC[vI][vJ] : vJ varie → écriture contiguë de la ligne vI de C           ✓
```

Tous les accès sont désormais contigus.

**5.A.** Créez un fichier `5A_multIKJ.c`. **Écrire** la **procédure** `multIKJ( int pN )` implémentant la multiplication avec l'ordre de boucles $i > k > j$.

{% details Indice %}
La boucle externe est sur `vI`, la boucle intermédiaire sur `vK`, la boucle interne sur `vJ`. Comme `vA[vI][vK]` est **constant** pour toute la boucle interne, stockez-le dans une variable locale avant cette boucle. Notez que `vC[vI][vJ]` est accumulé à travers plusieurs valeurs de `vK` : `vC` doit donc être remis à zéro avant l'appel.
{% enddetails %}

**5.B.** Comparez `multNaive` et `multIKJ` pour `vN` $\in \{256, 512, 1024\}$. Pour chaque valeur de `vN`, **répétez l'opération 10 fois et moyennez** les temps obtenus afin d'obtenir une mesure stable, indépendante des comportements aléatoires du CPU. Compilez **sans optimisation** :

| N    | `multNaive` (s) | `multIKJ` (s) | Gain (×) |
|------|-----------------|---------------|---------|
| 256  |                 |               |         |
| 512  |                 |               |         |
| 1024 |                 |               |         |

**5.C.** Maintenant, compilez le **même fichier** avec `-O3 -march=native`. Remplissez le tableau récapitulatif pour `vN = 1024`. **Répétez chaque mesure 10 fois et moyennez** pour obtenir des résultats stables.

<!-- ```bash
gcc -O0              -std=c99 -lm 5A_multIKJ.c 1A_fonctions.o -o 5A_O0.exe
gcc -O3 -march=native -std=c99 -lm 5A_multIKJ.c 1A_fonctions.o -o 5A_O3.exe
``` -->

| Implémentation      | `-O0` (s) | `-O3 -march=native` (s) | Gain compilation |
|---------------------|-----------|-------------------------|------------------|
| `multNaive`         |           |                         |                  |
| `multIKJ`           |           |                         |                  |

**5.D.** Avec `-O3`, le compilateur **vectorise** la boucle interne de `multIKJ` : il remplace les opérations scalaires par des instructions **SIMD** (*Single Instruction, Multiple Data*) qui traitent plusieurs `double` à la fois (4 avec AVX2, 8 avec AVX-512). Cela est possible car les accès à `vB[vK][vJ]` et `vC[vI][vJ]` sont **contigus**. Peut-il en faire autant pour `multNaive` ? Pourquoi ?



### Exercice 6 — Tiling pour la multiplication

Même avec l'ordre $i > k > j$, une matrice $1024 \times 1024$ occupe 8 Mo : les trois matrices dépassent le cache L1. La **multiplication par blocs** décompose le calcul en sous-multiplications de blocs $B \times B$ qui tiennent en L1 :

$$
C[i:i{+}B,\; j:j{+}B] \mathrel{+}= A[i:i{+}B,\; k:k{+}B] \;\times\; B[k:k{+}B,\; j:j{+}B]
$$

**6.A.** Calculez la taille de bloc $B$ maximale pour que trois blocs de `double` tiennent en cache L1 simultanément.

<!-- {% details Indice %}
$$3 \times B^2 \times 8 \leq L_1 \quad \Rightarrow \quad B \leq \sqrt{\frac{L_1}{24}}$$
Pour $L_1 = 32$ Ko : $B \leq 37$, soit $B = 32$ (puissance de 2 proche).
{% enddetails %} -->

**6.B.** Créez un fichier `6A_multBlocs.c`. **Écrire** la **procédure** `multBlocs( int pN, int pBlocs )`. La structure comporte 6 boucles imbriquées : 3 boucles externes sur les blocs (pas `pBlocs`) et 3 boucles internes dans le bloc (pas 1). L'ordre des boucles externes doit rester $i > k > j$.

<!-- {% details Indice : structure des 6 boucles %}
```
pour vI  de 0 à pN pas pBlocs :
  pour vK  de 0 à pN pas pBlocs :
    pour vJ  de 0 à pN pas pBlocs :
      pour vII de vI  à vI+pBlocs :
        pour vKK de vK  à vK+pBlocs :
          vAiikk = vA[vII][vKK]      ← variable locale (registre)
          pour vJJ de vJ à vJ+pBlocs :
            vC[vII][vJJ] += vAiikk * vB[vKK][vJJ]
```
{% enddetails %} -->

**6.C.** Testez `pBlocs` $\in \{8, 16, 32, 64\}$ pour `pN = 1024`, compilé avec `-O3`. Pour chaque configuration, **répétez l'opération 10 fois et moyennez** les temps obtenus. Comparez avec `multIKJ` :

| Implémentation              | Temps `-O3` (s) | Gain vs `multIKJ` (×) |
|-----------------------------|-----------------|----------------------|
| `multIKJ`                   |                 | 1×                   |
| `multBlocs` blocs=8         |                 |                      |
| `multBlocs` blocs=16        |                 |                      |
| `multBlocs` blocs=32        |                 |                      |
| `multBlocs` blocs=64        |                 |                      |

---

## Bilan

| Technique                          | Levier principal                  | Gain typique  |
|------------------------------------|-----------------------------------|---------------|
| Ordre de boucles ikj               | Localité spatiale (cache)         | ×3 – ×10     |
| Tiling transposition               | Réutilisation cache L1            | ×8 – ×10     |
| Flags `-O3`          | Vectorisation SIMD                | ×2 – ×8      |
| Tiling multiplication              | Réutilisation cache L1 + SIMD     | ×5 – ×15     |

Le message clé : **un même algorithme peut varier de plusieurs ordres de grandeur en performance** selon la façon dont il accède à la mémoire. En efficacité énergétique, un programme 10× plus rapide consomme approximativement 10× moins d'énergie.

---

## VII. Terminer ce TP en travail personnel avant le TP C3
