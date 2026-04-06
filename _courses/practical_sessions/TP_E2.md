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

**Créer** un répertoire `TP_E2` pour y stocker tous les exercices de ce TP.

Rappel de la commande de compilation `mycc` (TP C1, §2.B) :

```bash
mycc() { echo gcc: ; gcc "$@" -std=c99 -Wall -Wextra -lm ; echo Done. ;}
```

**Conservez tous les programmes C écrits au fur et à mesure.**

Afin de répondre aux questions, et de garder une trace écrite de vos expériences, vous pouvez télécharger le fichier suivant:
```
  wget https://rachddou.github.io/assets/files/TP_E2_formulaire.docx
```
Vous devez être en mesure de vous y réferez à tout moment du TP, lorsqu'un intervenant vous le demande.

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

**1.B.** **Écrire** la **procédure** `initAleatoire` qui prend un tableau `double pM[NMAX][NMAX]` et un entier `pN`, et remplit les `pN × pN` cases avec des valeurs réelles aléatoires entre -1 et 1. Pour se faciliter la vie, on définira `NMAX` comme une constante. 

{% details Rappel : nombre aléatoire entre 0 et 1 %}
```c
#include <stdlib.h>
/* Dans le main, initialiser le générateur une seule fois : */
srand(42);
/* Puis, pour obtenir un réel entre 0 et 1 : */
double vVal = (double)rand() / RAND_MAX;
```
Ici, les fonctions `srand` et `rand` sont des fonctions de la librairie standard du C. Nous en connaissons déjà quelques unes, comme des fonctions d'entrée et sortie (**I**nput/**O**utput)`printf` et `scanf`, auxquelles on accède en incluant `<stdio.h>` (pour **st**an**d**ard **i**nput **o**utput) au début de chaque fichier C. Ici, pour accèder aux fonctions de génération de nombres aléatoires, on doit appeler un autre fichier d'en tête `<stdlib.h>` qui définit d'autres fonctions primordiales de la libraire standard.

- `srand`(pour seed rand): le paramètre de `srand` est la **graine** (*seed*). Une graine fixe garantit la **reproductibilité** des résultats d'un TP à l'autre. Si vous recompilez le code, et le ré-exécutez, les nombres aléatoires générés sont identiques.
- `rand`: fonction qui génère un entier pseudo-aléatoire entre 0 et `RAND_MAX`.
- `RAND_MAX`: une constante de la librairie standard, qui peut varier en fonction des systèmes.
{% enddetails %}



**1.C.** **Écrire** la **procédure** `initZeros` qui remet à zéro toutes les cases de `pM` (taille `pN × pN`).

*Pourquoi en a-t-on besoin si les globaux sont déjà à zéro ?* Parce qu'on exécutera plusieurs mesures à la suite sur les mêmes tableaux globaux, et il faudra réinitialiser les résultats entre deux mesures.

**1.D.** **Écrire** la **procédure** `affMatrice` qui prend `double pM[NMAX][NMAX]`, un entier `pN` et un nom `char * pNom`, et affiche la matrice sous la forme suivante, y compris si certaines valeurs sont négatives :

```
Matrice A (4x4) :
  0.37	 -0.95	  0.73	  0.60
 -0.16	  0.06	  0.87	 -0.02
  0.40	  0.53	 -0.89	  0.11
  0.70	 -0.21	  0.97	  0.83
```
*Indice* Pour que les valeurs négatives soient alignées avec les valeurs positives qui ont un caractère en moins, on peut utiliser le format suivant : `%6.2lf`:
- .2 désigne le nombre de décimales à afficher.
- 5 désigne ici la longueur minimale du champ affiché par le printf. Si le nombre avec 2 décimales fait 5 caractères, alors 1 caractère vide sera rajouté *à droite*.


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

**Rappel compilation séparée (TP C1, §11) :** pour les exercices suivants, `1A_fonctions.c` sera compilé séparément et lié à chaque fichier exercice:

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

#### Rapide point sur les différents niveaux d'optimisation de GCC

- `-O0` — Aucune optimisation. Toutes les variables sont stockées en mémoire (pile), les registres ne sont pas réutilisés entre les instructions, et les accès redondants ne sont pas éliminés. Le code est traduit littéralement, ce qui facilite le débogage mais produit un maximum de trafic mémoire.
- `-O2` — Active un ensemble de passes d'optimisation qui réduisent significativement les accès mémoire : les variables scalaires fréquentes sont gardées dans les registres du processeur, les lectures redondantes d'une même valeur sont fusionnées, et les écritures dont le résultat n'est jamais lu sont supprimées. 
- `-O3` — Va plus loin en activant des transformations agressives : les boucles scalaires sont automatiquement vectorisées pour tirer parti des instructions SIMD (lecture de plusieurs valeurs en un seul accès), et d'autres optimisations fines sont réalisées. Ces optimisations peuvent toutefois être contre-productives si les structures de données ne sont pas bien agencées en mémoire.

Chacunes de ces optimisations activent en réalité une multitude d'options de compilations dont vous trouverez le détail sur ce [**lien**](https://gcc.gnu.org/onlinedocs/gcc-11.5.0/gcc/Optimize-Options.html).

Dans la suite de ce TP, nous comparerons les niveaux -O0 et -O2 afin d'observer concrètement l'impact de ces optimisations et d'évaluer rigoureusement les améliorations apportées à nos programmes. Nous n'utiliserons pas -O3 car ses transformations agressives, notamment la vectorisation automatique, risquent de masquer les optimisations que nous avons nous-mêmes implémentées.

### Exercice 2 — Transposition naïve

Créez un fichier `2A_transposition.c`. Ajoutez en variables globales :

```c
#include "1A.h"

double vA[NMAX][NMAX];
double vAt[NMAX][NMAX];   /* contiendra la transposée de vA */
```

**2.A.** **Écrire** la **procédure** `transposerNaive` qui calcule la transposée de `vA` dans `vAt`.

**2.B.** Écrire le `main` qui mesure le temps de `transposerNaive` pour `vN` $\in \{128, 256, 512, 1024\}$. Pour chaque valeur de `vN`, **répétez l'opération 50 fois et moyennez** les temps obtenus afin d'obtenir une mesure stable, indépendante des comportements aléatoires du CPU (interruptions système, variations de fréquence, etc.). Compilez d'abord **sans optimisation** puis **avec `-O2`**.
**Un problème?** Si la compilation séparée donne une erreur, c'est que vous avez deux fonctions `main`. Afin de corriger ce conflit, commentez la fonction `main` dans le fichier `1A_fonctions.c` et relancez la compilation.

Exécutez et remplissez le tableau :

| N    | Temps `-O0` (s) | Temps `-O2` (s) | Rapport |
|------|-----------------|-----------------|---------|
| 128  |                 |                 |         |
| 256  |                 |                 |         |
| 512  |                 |                 |         |
| 1024 |                 |                 |         |


**2.C.** Que remarquez-vous sur le rapport entre `-O0` et `-O2` pour la version naïve ? Comment expliquer que le compilateur n'améliore pas (ou peu) les performances ?

{% details Explication %}
La transposition naïve est limitée non pas par le **calcul** (une simple affectation), mais par les **accès mémoire**. Pour `vJ` variant dans la boucle interne :
- `vAt[vI][vJ]` : écriture contiguë (ligne vI de vAt) ✓
- `vA[vJ][vI]`  : lecture non contiguë (colonne vI de vA) ✗ → un *cache miss* par élément

Pour $N = 1024$, la lecture de la colonne `vI` de `vA` génère 1024 *cache misses* séquentiels. Le compilateur peut appliquer `-O2`, mais il ne peut pas réorganiser les accès mémoire non contigus automatiquement → le goulot d'étranglement reste la RAM.
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
Deux boucles **externes** ( de pas `pBlocs`) parcourent chaque bloc de tailles $\text{pBlocs} \times \text{pBlocs}$. Deux boucles **internes** (de pas 1) effectuent la transposition à l'intérieur de chaque bloc :
<!-- ```
pour vI de 0 à pN avec pas pBlocs :
    pour vJ de 0 à pN avec pas pBlocs :
        pour vII de vI à vI+pBlocs :
            pour vJJ de vJ à vJ+pBlocs :
                vAt[vJJ][vII] = vA[vII][vJJ]
``` -->
{% enddetails %}

**3.C.** Mesurez les performances de `transposerBlocs` pour `pN = 1024` et `pBlocs` $\in \{8, 16, 32, 64\}$, **avec `-O2`**. Pour chaque configuration, **répétez l'opération 10 fois et moyennez** les temps obtenus afin d'obtenir une mesure stable, indépendante des comportements aléatoires du CPU. Comparez avec `transposerNaive` compilée avec `-O2` :

| Implémentation            | Temps `-O2` (s) | Rapport vs naïf `-O2` |
|---------------------------|-----------------|----------------------|
| `transposerNaive` `-O0`   |                 | (référence)           |
| `transposerNaive` `-O2`   |                 |                       |
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

**Créez** un fichier `4A_multiplication.c` incluant `"1A.h"` et déclarant les globaux :

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

**4.B.** Écrire le `main` qui mesure le temps de `multNaive` pour `vN` $\in \{128, 256, 512, 1024\}$. (Vous pouvez par exemple faire une boucle sur `vN`).  Pour chaque valeur de `vN`, **répétez l'opération 10 fois et moyennez** les temps obtenus afin d'obtenir une mesure stable, indépendante des comportements aléatoires du CPU (interruptions système, variations de fréquence, etc.). Compilez **sans optimisation**.

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

### Exercice 5 — Multiplication par blocs (ordre i, j, k)
 
#### Pourquoi la version naïve est lente
 
Pour `vI` et `vJ` fixés, la boucle sur `vK` accède à :
 
```
- vA[vI][vK] : vK varie → lecture contiguë de la ligne vI de A    ✓
- vB[vK][vJ] : vK varie → lecture de la colonne vJ de B            ✗
               deux éléments consécutifs sont espacés de NMAX*8 octets
               → un cache miss par accès, quasiment tous les accès sont lents
```
 
Pour $N = 1024$, les trois matrices occupent $3 \times 8$ Mo = 24 Mo, bien au-delà du cache L1 (32 Ko) et du cache L2 (quelques Mo). Chaque accès à la colonne de $B$ déclenche donc un aller-retour jusqu'à la **RAM** (~200 cycles d'attente).
 
#### Principe du tiling pour la multiplication
 
La **multiplication par blocs** (*tiling*) consiste à décomposer le calcul en sous-multiplications de blocs $B \times B$ :
 
$$
C[i:i{+}B,\; j:j{+}B] \mathrel{+}= A[i:i{+}B,\; k:k{+}B] \;\times\; B[k:k{+}B,\; j:j{+}B]
$$
 
Si les blocs actifs tiennent dans le cache L1, les *cache misses* coûtent au pire ~4 cycles (L1→L2) au lieu de ~200 cycles (L1→RAM). On ne supprime pas les *cache misses* non contigus sur la colonne de $B$, mais on réduit drastiquement leur coût.
 
**5.A.** Calculez la taille de bloc $B$ maximale pour que trois blocs de `double` (A, B, C) tiennent simultanément en cache L1.
 
{% details Indice %}
$$3 \times B^2 \times 8 \leq L_1 \quad \Rightarrow \quad B \leq \sqrt{\frac{L_1}{24}}$$
Pour $L_1 = 32$ Ko : $B \leq 37$, soit $B = 32$ (puissance de 2 inférieure la plus proche).
{% enddetails %}
 
**5.B.** Créez un fichier `5A_multBlocs.c`. **Écrire** la **procédure** `multBlocsIJK( int pN, int pBs )` qui implémente la multiplication par blocs **en conservant l'ordre $i > j > k$** à l'intérieur de chaque bloc. La structure comporte 6 boucles imbriquées : 3 boucles externes sur les blocs (pas `pBs`) et 3 boucles internes dans le bloc (pas 1).
 
<!-- {% details Indice : structure des 6 boucles %}
```
pour vI  de 0 à pN pas pBs :
  pour vJ  de 0 à pN pas pBs :
    pour vK  de 0 à pN pas pBs :
      pour vII de vI à vI+pBs :
        pour vJJ de vJ à vJ+pBs :
          vSomme = 0.0
          pour vKK de vK à vK+pBs :
            vSomme += vA[vII][vKK] * vB[vKK][vJJ]
          vC[vII][vJJ] += vSomme
```
L'accès `vB[vKK][vJJ]` avec `vKK` qui varie est toujours non contigu (colonne de B), mais `vKK` ne parcourt qu'un bloc de taille `pBs` : le bloc tient en L1 → *cache miss* L1 (~4 cycles) au lieu de RAM (~200 cycles).
{% enddetails %} -->
 
**5.C.** Comparez `multNaive` et `multBlocsIJK` pour `vN = 1024` et `pBs` $\in \{16, 32, 64\}$, **sans optimisation**.
 
 
| Implémentation        | Temps `-O0` (s) | Gain vs naïf (×) |
|-----------------------|-----------------|-----------------|
| `multNaive`           |                 | ×1               |
| `multBlocsIJK` bs=16  |                 |                  |
| `multBlocsIJK` bs=32  |                 |                  |
| `multBlocsIJK` bs=64  |                 |                  |
 


**5.D.** Le tiling améliore les performances sans changer l'ordre des boucles. Quelle est la source du gain ? 


### Exercice 6 — Version optimisée (ordre i, k, j)

#### Analyse des accès mémoire dans la version naïve

Nous venons de voir qu'on peut améliorer les performances en travaillant sur des blocs qui tiennent en cache. Mais existe-t-il une solution encore plus simple ?

Observons ce qui se passe si on permute les boucles sur `vJ` et `vK` (ordre $i > k > j$) :
 
```
Pour vI et vK fixés, boucle interne sur vJ :
- vA[vI][vK] : constante → variable locale vAik (registre)           ✓
- vB[vK][vJ] : vJ varie  → lecture contiguë de la ligne vK de B     ✓
- vC[vI][vJ] : vJ varie  → écriture contiguë de la ligne vI de C    ✓
```
Tous les accès deviennent **contigus** : plus aucun *cache miss* non contigu.


**6.A.** Créez un fichier `6A_multIKJ.c`. **Écrire** la **procédure** `multIKJ( int pN )` implémentant la multiplication avec l'ordre de boucles $i > k > j$.

<!-- {% details Indice %}
La boucle externe est sur `vI`, la boucle intermédiaire sur `vK`, la boucle interne sur `vJ`. Comme `vA[vI][vK]` est **constant** pour toute la boucle interne, stockez-le dans une variable locale avant cette boucle. Notez que `vC[vI][vJ]` est accumulé à travers plusieurs valeurs de `vK` : `vC` doit donc être remis à zéro avant l'appel.
{% enddetails %} -->



**6.B.** Comparez `multNaive`, `multBlocsIJK` (meilleure taille de bloc) et `multIKJ` pour `vN = 1024`, d'abord **sans optimisation** puis **avec `-O2`** :
 

| Implémentation          | `-O0` (s) | `-O2` (s) |
|-------------------------|-----------|-------------------------|
| `multNaive`             |           |                         |
| `multBlocsIJK` bs=32    |           |                         |
| `multIKJ`               |           |                         |                 |




**6.C.** Avec `-O2`, `multIKJ` surpasse-t-elle `multBlocsIJK` ?


<!-- --- -->
<!-- 
## Bilan

| Technique                          | Levier principal                  | Gain typique  |
|------------------------------------|-----------------------------------|---------------|
| Ordre de boucles ikj               | Localité spatiale (cache)         | ×3 – ×10     |
| Tiling transposition               | Réutilisation cache L1            | ×8 – ×10     |
| Flags `-O2`          | Vectorisation SIMD                | ×2 – ×8      |
| Tiling multiplication              | Réutilisation cache L1 + SIMD     | ×5 – ×15     |

Le message clé : **un même algorithme peut varier de plusieurs ordres de grandeur en performance** selon la façon dont il accède à la mémoire. En efficacité énergétique, un programme 10× plus rapide consomme approximativement 10× moins d'énergie. -->

---

## VII. Terminer ce TP en travail personnel avant le TP C3
