---
layout: page
title: TP E3 — Structures de données et efficacité mémoire
description: Comparer tableaux et listes chaînées sur des critères de performance, puis optimiser un algorithme classique sur listes chaînées.
---

*Troisième TP du cours Programmation en C et Efficacité Énergétique (E2)*

## Préambule

### Contexte

Dans les TPs C3 et C4, vous avez appris à manipuler des tableaux dynamiques et des listes chaînées. Ces deux structures permettent de stocker des séquences d'entiers, mais leurs performances diffèrent radicalement selon l'opération effectuée. Ce TP vous amène à **mesurer ces différences quantitativement** et à comprendre pourquoi elles existent — non seulement sur le plan algorithmique, mais aussi sur le plan physique (cache, mémoire, fragmentation).

Le lien avec l'efficacité énergétique est direct : comme établi en TP E1, un programme deux fois plus rapide consomme approximativement deux fois moins d'énergie. Un mauvais choix de structure de données peut engendrer des différences de plusieurs ordres de grandeur pour un résultat identique.

### Objectifs

- Mesurer et comparer les performances de tableaux et listes chaînées sur des opérations élémentaires
- Observer expérimentalement les comportements asymptotiques $O(1)$, $O(n)$, $O(n^2)$
- Comprendre l'impact du layout mémoire sur les performances (AoS vs SoA)
- Implémenter et comparer deux algorithmes de détection de cycle, identiques en temps mais différents en espace

### Mise en place du TP

**Créez** un répertoire `TP_E3` et téléchargez l'archive contenant les fichiers utilitaires pré-fournis :

```bash
mkdir Documents/EE_PC/TP_E3
cd Documents/EE_PC/TP_E3
wget https://rachddou.github.io/assets/files/TP_E3.tar.gz
tar -xzvf TP_E3.tar.gz
```

L'archive contient `E3_util.h` et `E3_util.c` que vous **n'avez pas à écrire** — lisez-les pour comprendre les types et fonctions disponibles.

Rappel de la commande `mycc` (TP C1, §2.B) :

```bash
mycc() { echo gcc: ; gcc "$@" -std=c99 -Wall -Wextra -lm ; echo Done. ;}
```

Pour **compiler** un exercice avec les utilitaires (rappel compilation séparée, TP C1, §11) :

```bash
mycc -c E3_util.c                 # produit E3_util.o (une seule fois)
mycc -c E3_insertion.c
mycc E3_insertion.o E3_util.o -o insertion.x
./insertion.x
```

**Conservez tous les programmes C écrits au fur et à mesure.**

Pour noter vos réponses et mesures, ouvrez le formulaire :

```bash
wget https://rachddou.github.io/assets/files/TP_E3_formulaire.docx
```

*N'oubliez pas de cliquer sur ▸ pour obtenir des explications supplémentaires.*

**Vous devez terminer le tp E3.1 avant le début du [TP E3.2](#p2)**

---

## Séance 1 (TP E3.1)

### Partie 1 — Prise en main des fichiers utilitaires

Ouvrez et lisez les fichiers `E3_util.h` et `E3_util.c`. Repérez les types suivants qui seront utilisés dans tout le TP :

```c
/* --- Liste chaînée — cohérente avec le TP C4 --- */
typedef struct tmp_maillon {
    int                  contenu;
    struct tmp_maillon * suivant;
} Maillon;
typedef Maillon *  PtrMaillon;   /* pointeur vers un maillon */
typedef PtrMaillon Liste;        /* tête de liste            */

/* --- Tableau dynamique — enrichi par rapport au TP C4
 *     (ajout de taille/capacite pour mesurer les insertions) --- */
typedef struct { int * donnees; int taille; int capacite; } TabDyn;
```

Les fonctions utilitaires fournies suivent également les conventions de C4 :

| Fonction | Signature | Description |
|---|---|---|
| `listeVide` | `int listeVide(Liste pL)` | 1 si `pL == NULL` |
| `creeMaillon` | `PtrMaillon creeMaillon(int pContenu)` | Alloue un maillon (`suivant` mis à `NULL`) |
| `ajouteDebut` | `Liste ajouteDebut(Liste pL, PtrMaillon pPM)` | Chaîne `pPM` en tête |
| `ajouteFin` | `Liste ajouteFin(Liste pL, PtrMaillon pPM)` | Chaîne `pPM` en queue (récursif) |
| `supprimePremier` | `Liste supprimePremier(Liste pL)` | Supprime et libère la tête |
| `supprimeDernier` | `Liste supprimeDernier(Liste pL)` | Supprime et libère la queue |
| `afficheListe` | `void afficheListe(Liste pL)` | Affiche `\|3\|->\|7\|->NULL` (récursif) |
| `libereListe` | `void libereListe(Liste * pL)` | Libère tous les maillons |
| `creerListeAleatoire` | `Liste creerListeAleatoire(int pN)` | Liste de `pN` entiers aléatoires |

**1.A.** Compilez et exécutez le test `E3_part1.c` :

```bash
mycc -c E3_util.c                   # produit E3_util.o (à faire une seule fois)
mycc -c E3_part1.c
mycc E3_part1.o E3_util.o -o part1.x
./part1.x
```

Vérifiez que l'affichage est conforme : liste vide, insertions en tête et en queue, suppression, libération, liste aléatoire. La sortie de `afficheListe` doit suivre le format `|val|->…->NULL` du TP C4. Si la compilation échoue, appelez un encadrant avant de continuer.

---

### Partie 2 — Tableau vs Liste : comportements asymptotiques

#### II. Rappel théorique

| Opération              | Tableau (`TabDyn`) | Liste chaînée  |
|------------------------|--------------------|----------------|
| Insertion en tête      | $O(n)$ par insertion | $O(1)$ par insertion |
| Accès à l'élément $i$  | $O(1)$             | $O(n)$         |

L'objectif de cette partie est de **vérifier expérimentalement** ce tableau, et de comprendre pourquoi le tableau se comporte souvent encore *mieux* que sa complexité ne le prédit.

#### Exercice 2 — Insertion en tête

Créez un fichier `E3_insertion.c` incluant `"E3_util.h"`.

**2.A.** Implémentez la procédure `insereEnTeteTab(TabDyn * pT, int pVal)` qui insère `pVal` en position 0 du tableau en décalant tous les éléments existants d'un cran vers la droite. Si `pT->taille == pT->capacite`, la fonction ne fait rien.

{% details Indice : ordre du décalage %}
Pour insérer en position 0 sans écraser de valeurs, décalez les éléments **de droite à gauche** : déplacez d'abord l'élément à l'index `taille-1` vers `taille`, puis `taille-2` vers `taille-1`, etc.
{% enddetails %}

**2.B.** Implémentez la procédure `insereEnTeteListe(Liste * pL, int pVal)` qui insère `pVal` en tête de liste en $O(1)$, en utilisant `creeMaillon` et `ajouteDebut` fournis dans `E3_util`.

**2.C.** Écrivez dans le `main` les instructions nécessaires pour mesurer, pour $n \in \{2000,\ 5000,\ 10000,\ 20000\}$, le temps nécessaire pour effectuer $n$ insertions en tête successives dans un tableau vide (pré-alloué à capacité $n$). De quelles fonctions disposez vous dans `E3_util.h` pour créer un tableau et libérer l'espace alloué?


**2.D.** Répétez le même procédé pour des insertions en tête pour une liste chaînée vide.

Remplissez le tableau dans le formulaire :

| $n$     | Temps tableau (s) | Temps liste (s) | Rapport |
|---------|-------------------|-----------------|---------|
| 2 000   |                   |                 |         |
| 5 000   |                   |                 |         |
| 10 000  |                   |                 |         |
| 20 000  |                   |                 |         |

**2.E.** Calculez sur papier le nombre total de décalages effectués pour $n$ insertions en tête dans un tableau initialement vide. En déduire la complexité totale.

{% details Indice : somme arithmétique %}
Lors de la $k$-ième insertion ($k$ de $0$ à $n-1$), le tableau contient déjà $k$ éléments à décaler. Le coût total est :
$$\sum_{k=0}^{n-1} k = \frac{n(n-1)}{2}$$
Quelle classe de complexité cela représente-t-il ? Vérifiez : si $n$ double, le temps est multiplié par combien ?
{% enddetails %}

**2.F.** Le temps du tableau doit être multiplié par $\approx 4$ chaque fois que $n$ double. Vérifiez ce facteur dans vos mesures. Correspond-il à la complexité calculée en **2.E** ?

#### Exercice 3 — Accès aléatoire

Créez un fichier `E3_acces.c` incluant `"E3_util.h"`.

**3.A.** Implémentez `int accesTab(TabDyn pT, int pI)` retournant l'élément à l'index `pI` en $O(1)$. Si `pI` est hors bornes (inférieur à 0 ou supérieur ou égal à `taille`), la fonction retourne `-1`.

**3.B.** Implémentez `int accesListe(Liste pL, int pI)` qui retourne l'élément à la position `pI` en parcourant la liste avec un `PtrMaillon`.

**3.C.** Pour montrer que l'accès tableau est $O(1)$, mesurez le temps de $10^7$ accès aléatoires sur un tableau de taille $n$, pour $n \in \{10^4,\ 10^5,\ 10^6\}$.

| $n$       | Temps $10^7$ accès tableau (s) | Temps / accès (µs) |
|-----------|--------------------------------|--------------------|
| $10^4$    |                                |                    |
| $10^5$    |                                |                    |
| $10^6$    |                                |                    |

Le temps doit rester **quasi-constant** : c'est la signature d'une complexité $O(1)$.

**3.D.** Pour montrer que l'accès liste est $O(n)$, mesurez le temps de $5\,000$ accès aléatoires sur une liste de taille $n$, pour $n \in \{1000,\ 3000,\ 6000,\ 10000\}$.

| $n$    | Temps $5\,000$ accès liste (s) | Temps / accès (µs) |
|--------|--------------------------------|--------------------|
| 1 000  |                                |                    |
| 3 000  |                                |                    |
| 6 000  |                                |                    |
| 10 000 |                                |                    |

Le temps doit croître **linéairement** avec $n$.

**3.E.** En observant vos mesures, le tableau est probablement encore *plus rapide* par rapport à la liste que le simple rapport $O(1)$ vs $O(n)$ ne le prédit. Quelle raison physique, liée au matériel, explique ce surcroît d'avantage pour le tableau ?

{% details Explication : lignes de cache et localité spatiale %}
Un tableau stocke ses éléments de façon **contiguë** en mémoire. Le processeur charge la mémoire par blocs de 64 octets (lignes de cache — cf. TP E2). Lors d'un accès à `donnees[i]`, les éléments `donnees[i+1]`, `donnees[i+2]`... sont automatiquement chargés en cache L1 (*hardware prefetcher*). Les accès voisins sont donc quasi-gratuits.

Une liste chaînée disperse ses maillons à des adresses arbitraires dans le tas. Chaque déréférencement `maillon->suivant` pointe vers un emplacement inconnu du cache : c'est un **défaut de cache** (~200 cycles d'attente RAM) quasiment garanti. Ce surcoût physique s'ajoute au coût algorithmique $O(n)$.
{% enddetails %}

---

### Partie 3 — Impact du layout mémoire : AoS vs SoA

#### III. Array of Structs vs Struct of Arrays

Vous avez créé en TP C3 des structures comme `Etudiant { char nom[30]; char prenom[30]; int promo; }`. Une collection de $n$ étudiants peut être organisée de deux façons fondamentalement différentes :

**Array of Structs (AoS)** — tableau de structures :
```c
EtudiantAoS tab[N];
/* En mémoire : [id|note|nom...][id|note|nom...][id|note|nom...]... */
```

**Struct of Arrays (SoA)** — structure de tableaux :
```c
EtudiantsSoA data;   /* data.ids[N], data.notes[N], data.noms[N] */
/* En mémoire : [id id id ...][note note note ...][nom nom nom ...] */
```

Ces deux représentations stockent exactement les mêmes données, mais leur organisation mémoire a un impact majeur sur les performances selon l'opération effectuée.

#### Exercice 4 — Calcul de moyenne : AoS vs SoA

Créez un fichier `E3_AoSSoA.c`. Les types à utiliser sont :

```c
#define NOM_MAX  32
#define HIST_MAX 16   /* 16 dernières notes */
#define ADR_MAX  60

/* AoS : 1 struct complète par étudiant
 * sizeof = 4+4(padding)+8 + 32 + 128 + 60 + 4 = 240 octets
 * Pour n = 1 000 000 étudiants : AoS occupe 240 Mo en RAM */
typedef struct {
    int    id;                    /*   4 octets */
    double note;                  /*   8 octets */
    char   nom[NOM_MAX];          /*  32 octets */
    double historique[HIST_MAX];  /* 128 octets — historique des notes */
    char   adresse[ADR_MAX];      /*  60 octets */
    int    promo;                 /*   4 octets */
} EtudiantAoS;                   /* Total : 240 octets */

/* SoA : 1 tableau par champ
 * Pour n = 1 000 000 étudiants : SoA.notes n'occupe que 8 Mo en RAM */
typedef struct {
    int    * ids;
    double * notes;
    double * historiques; /* bloc plat : n * HIST_MAX doubles */
    char   * noms;        /* bloc plat : n * NOM_MAX  octets  */
    char   * adresses;    /* bloc plat : n * ADR_MAX  octets  */
    int    * promos;
    int      n;
} EtudiantsSoA;
```

**4.A.** Affichez `sizeof(EtudiantAoS)` et `sizeof(double)`. Calculez le nombre de structs AoS et le nombre de notes SoA qui tiennent dans une ligne de cache de 64 octets. En déduire le rapport théorique d'efficacité cache pour une opération qui ne lit que `note`. Pour $n = 10^6$, calculez la taille en RAM de l'ensemble AoS et du seul tableau `notes` en SoA.

{% details snprintf — écrire dans un tableau de caractères %}
`snprintf` est la version « sûre » de `printf` qui écrit dans un tableau de caractères au lieu de la console :

```c
char buf[32];
snprintf(buf, sizeof(buf), "Etudiant_%d", i);
/* buf contient maintenant "Etudiant_0", "Etudiant_1", etc. */
```

Signature : `int snprintf(char *dest, size_t n, const char *format, ...)`.  
Le deuxième argument `n` est la taille maximale à écrire (terminateur `'\0'` inclus) : il évite tout débordement de tampon. Les spécificateurs de format (`%d`, `%f`, `%s`…) sont identiques à ceux de `printf`.
{% enddetails %}

{% details Rappel : nombre aléatoire réel dans [0, 20] %}
En utilisant la formule introduite en TP E2 :
```c
double vVal = (double)rand() / RAND_MAX * 20.0;
```
Pour un intervalle $[a, b]$ quelconque : `a + (double)rand() / RAND_MAX * (b - a)`.
{% enddetails %}

**4.B.** Écrivez `EtudiantAoS * creerAoS(int pN)` qui alloue avec `malloc` un tableau de $n$ `EtudiantAoS` et initialise chaque étudiant $i$ ainsi :
- `id = i`
- `note` : réel aléatoire dans $[0, 20]$
- `nom` : chaîne `"Etudiant%d"` (avec `i`) formatée dans `tab[i].nom` avec `snprintf`
- `adresse` : chaîne `"Rue du Code %d"` (avec `i`) formatée dans `tab[i].adresse` avec `snprintf`
- `historique` : $16$ réels aléatoires dans $[0, 20]$
- `promo` : entier aléatoire dans $\{1, \ldots, 5\}$

Écrivez aussi `void libereAoS(EtudiantAoS * pTab)` qui libère le bloc alloué.

**4.C.** Écrivez `EtudiantsSoA creerSoA(int pN)` qui alloue un tableau séparé par champ avec `malloc`, et initialise chaque étudiant $i$ avec les mêmes valeurs qu'en **4.B**. Pour les champs texte, utilisez un **bloc plat** et accédez à l'entrée $i$ par arithmétique de pointeur :
- `noms = malloc(pN * NOM_MAX)` — le nom $i$ se trouve à `&vS.noms[i * NOM_MAX]`
- `adresses = malloc(pN * ADR_MAX)` — l'adresse $i$ se trouve à `&vS.adresses[i * ADR_MAX]`

**4.D.** Écrivez `void libereSoA(EtudiantsSoA * pS)` qui libère les 6 blocs alloués par `creerSoA` : `ids`, `notes`, `historiques`, `noms`, `adresses`, `promos`.

**4.E.** Vérifiez `creerAoS` et `creerSoA` sur $n = 3$. Créez les deux collections avec la même graine (`srand(42)`), puis affichez pour l'étudiant d'indice 0 son `nom`, sa `note` et son `adresse` dans chaque représentation. Les valeurs doivent être identiques entre AoS et SoA. Libérez ensuite les deux collections.

**4.F.** Écrivez les deux fonctions de calcul de moyenne :
- `double moyenneAoS(EtudiantAoS * pTab, int pN)` : parcourt `pTab[i].note` pour $i = 0 \ldots n-1$.
- `double moyenneSoA(EtudiantsSoA * pS)` : parcourt `pS->notes[i]` pour $i = 0 \ldots n-1$.

**4.G.** Vérifiez `moyenneAoS` et `moyenneSoA` sur $n = 5$ : créez les deux collections avec la même graine (`srand(42)`), appelez chaque fonction et vérifiez que les deux moyennes sont identiques. Libérez ensuite les deux collections.

**4.H.** Mesurez le temps de chaque fonction pour $n \in \{50\,000,\ 200\,000,\ 500\,000,\ 1\,000\,000\}$. **Répétez 10 fois et moyennez.** Calculez aussi la taille en RAM de AoS et de `SoA.notes` pour chaque $n$.

| $n$       | Temps AoS (s) | Temps SoA (s) | Rapport | AoS RAM | SoA.notes |
|-----------|---------------|---------------|---------|---------|-----------|
| 50 000    |               |               |         | 12 Mo   | 400 Ko    |
| 200 000   |               |               |         | 48 Mo   | 1.6 Mo    |
| 500 000   |               |               |         | 120 Mo  | 4 Mo      |
| 1 000 000 |               |               |         | 240 Mo  | 8 Mo      |

**4.I.** Observez-vous une évolution du rapport en fonction de $n$ ? Pourquoi le rapport augmente-t-il quand $n$ est grand ? À quel moment (entre $n = 50\,000$ et $n = 200\,000$) le rapport fait-il un saut, et pourquoi ?

{% details Explication %}
Pour `moyenneAoS`, le processeur charge un `EtudiantAoS` complet (240 octets) pour lire 8 octets de `note` : 96% de la bande passante est gaspillée. Pour `moyenneSoA`, le tableau `notes` est contigu : chaque ligne de cache transporte 8 notes utiles. Le ratio théorique est $240/8 = 30\times$.

Quand AoS déborde du cache L3 (typiquement 6–32 Mo), chaque accès déclenche un aller-retour vers la RAM, tandis que `SoA.notes` (8 Mo pour $n = 10^6$) reste souvent en cache. En pratique, le rapport mesuré est de **3× à 8×** — atténué par le préfetcheur matériel, mais réel et reproductible.
{% enddetails %}


**Vous devez terminer le tp E3.1 avant le début du [TP E3.2](#p2)**
<a name="p2"></a>
---

## Séance 2 (TP E3.2)



### Partie 4 — Optimisation algorithmique : détection de cycle

#### IV. Algorithme $O(n)$ vs $O(n^2)$, et $O(n)$ vs $O(1)$ en espace

**Problème :** une liste est dite **cyclique** si l'un de ses maillons pointe vers un maillon précédent au lieu de pointer vers `NULL`. Étant donnée une liste, déterminer si elle contient un cycle.

```
Liste cyclique (pN=6, pPos=2) :
  [0] -> [1] -> [2] -> [3] -> [4] -> [5]
                  ^                    |
                  |____________________|
```

Nous allons comparer deux algorithmes de détection. Leur différence illustre parfaitement le lien entre **espace mémoire** et **efficacité énergétique** : une allocation mémoire excessive augmente la pression sur le cache et ralentit l'exécution même quand le nombre d'opérations est comparable.

Créez un fichier `E3_cycle.c` incluant `"E3_util.h"`.

#### Exercice 5 — Création et libération d'une liste cyclique

**5.A.** Écrivez `Liste creerListeCyclique(int pN, int pPos)` qui crée une liste de `pN` maillons (valeurs $0$ à $pN-1$), puis fait pointer le champ `suivant` du dernier maillon vers le maillon à la position `pPos` (0-indexé).

{% details Indice : mémoriser le maillon cible %}
Lors de la boucle de création, utilisez `creeMaillon(i)` pour chaque maillon et conservez un `PtrMaillon vCible` sur le maillon dont l'index vaut `pPos`. Maintenez également un `PtrMaillon vQueue` pour chaîner les maillons sans appeler `ajouteFin` (qui est récursif en O(n) et deviendrait O(n²) en boucle). À la fin, affectez `vQueue->suivant = vCible`.
{% enddetails %}

**5.B.** Écrivez `void libereListeCyclique(Liste pL, int pN)` qui libère exactement `pN` maillons en avançant `pN` fois depuis la tête avec un `PtrMaillon`. **Attention :** `libereListe` appelle `supprimePremier` en boucle et bouclerait indéfiniment sur une liste cyclique — ne l'utilisez pas ici.

#### Exercice 6 — Version naïve : mémorisation des adresses visitées

**6.A.** Écrivez `int contientCycleNaif(Liste pL, int pNMax)` qui :
1. Alloue un tableau de `pNMax` pointeurs (`Maillon **`),
2. À chaque nouveau maillon visité, compare son adresse à toutes les adresses déjà mémorisées,
3. Retourne 1 si une adresse est vue deux fois (cycle détecté), 0 si `NULL` est atteint,
4. Libère le tableau avant de retourner.

{% details Complexité %}
À chaque étape $k$, on compare le maillon courant aux $k$ précédents : coût $O(k)$. Sur une liste de $n$ maillons avant détection, le coût total est $\sum_{k=0}^{n} k \approx n^2/2$ : c'est un algorithme **$O(n^2)$ en temps, $O(n)$ en mémoire**.
{% enddetails %}

#### Exercice 7 — Version optimisée : algorithme de Floyd

**7.A.** Écrivez `int contientCycleFloyd(Liste pL)` qui utilise deux pointeurs :
- `vLent` avance d'un maillon à chaque étape,
- `vRapide` avance de deux maillons à chaque étape.

Si la liste est cyclique, les deux pointeurs se rencontreront nécessairement.

{% details Indice : conditions de terminaison %}
La boucle s'arrête dans deux cas :
- `vRapide == NULL` ou `vRapide->suivant == NULL` → pas de cycle, retourner 0.
- `vLent == vRapide` → cycle détecté, retourner 1.

**Pourquoi ça converge ?** Si un cycle de longueur $c$ existe, une fois que les deux pointeurs l'ont rejoint, la distance entre eux diminue de 1 à chaque étape (le rapide "rattrape" le lent par l'intérieur). La rencontre est garantie en au plus $c$ étapes.
{% enddetails %}

Quelle est la complexité en **temps** et en **mémoire** de Floyd ?

**7.B.** Testez vos deux fonctions sur une liste cyclique de 6 éléments (`pPos=2`) et sur une liste acyclique de 6 éléments. Vérifiez que les deux retournent le bon résultat avant de passer aux mesures.

**7.C.** Mesurez et comparez les deux versions pour des listes cycliques avec `pPos = pN/2`, pour $pN \in \{2000,\ 4000,\ 8000,\ 16000\}$. **Répétez 50 fois et moyennez.**

| $n$    | Temps naïf (s) | Temps Floyd (s) | Rapport |
|--------|----------------|-----------------|---------|
| 2 000  |                |                 |         |
| 4 000  |                |                 |         |
| 8 000  |                |                 |         |
| 16 000 |                |                 |         |

**7.D.** Quand $n$ double, par quel facteur le temps du naïf est-il multiplié ? Et celui de Floyd ? Est-ce cohérent avec leurs complexités respectives ?

**7.E.** Floyd est $O(1)$ en mémoire et le naïf est $O(n)$. En dehors du gain algorithmique ($O(n^2)$ vs $O(n)$), le fait que Floyd n'alloue aucune mémoire supplémentaire a-t-il un impact sur les performances que vous observez ? Comment le quantifier ?

{% details Explication : le coût invisible de malloc %}
La version naïve appelle `malloc(pNMax * sizeof(Maillon *))` à chaque appel, ce qui demande au système d'exploitation de trouver un bloc libre dans le tas. Pour `pNMax = 16000`, cela représente 128 Ko à initialiser et à inscrire dans les métadonnées de l'allocateur. Cette mémoire n'est pas dans le cache L1 de 32 Ko : son parcours déclenche des défauts de cache supplémentaires, s'ajoutant au coût algorithmique $O(n^2)$ déjà élevé.

Floyd, lui, n'utilise que deux pointeurs (16 octets) — ils restent en registres CPU tout au long de l'exécution. C'est la version la plus économe en énergie possible pour ce problème.
{% enddetails %}

---

## Bilan

Complétez le tableau synthétique suivant avec vos mesures les plus représentatives :

| Opération / Algorithme           | Structure      | Complexité temps | Complexité mémoire | Facteur observé vs. référence |
|----------------------------------|----------------|------------------|--------------------|-------------------------------|
| $n$ insertions en tête           | Tableau        | $O(n^2)$         | $O(n)$             | référence                     |
| $n$ insertions en tête           | Liste chaînée  | $O(n)$           | $O(n)$             |                               |
| $10^7$ accès aléatoires          | Tableau        | $O(1)$ par accès | —                  | référence                     |
| $5000$ accès aléatoires          | Liste chaînée  | $O(n)$ par accès | —                  |                               |
| Calcul de moyenne                | AoS            | $O(n)$           | $O(1)$ extra       | référence                     |
| Calcul de moyenne                | SoA            | $O(n)$           | $O(1)$ extra       |                               |
| Détection de cycle               | Naïf           | $O(n^2)$         | $O(n)$             | référence                     |
| Détection de cycle               | Floyd          | $O(n)$           | $O(1)$             |                               |

**Message clé :** deux programmes produisant le même résultat peuvent différer d'un facteur $10$ à $10^6$ en temps d'exécution — et donc en consommation énergétique — selon le choix de structure de données, de layout mémoire et d'algorithme. La complexité $O$ donne la tendance asymptotique, mais le comportement du cache et la pression mémoire déterminent les performances réelles.

---

*Si vous n'avez pas terminé le TP C4, terminez-le. Si vous n'avez pas terminé le TP E2, terminez-le maintenant.*
