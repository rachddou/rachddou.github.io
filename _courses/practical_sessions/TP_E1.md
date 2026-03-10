---
layout: page
title: TP E1 — Efficacité énergétique de la programmation
description: Mesurer et comparer la consommation énergétique de différentes implémentations algorithmiques.
---
# TP E1 : Efficacité énergétique de la programmation

*Premier TP du cours Programmation en C et Efficacité Energétique (E2)*

## Préambule

### Objectifs

Dans ce premier TP sur l'efficacité énergétique de la programmation, on s'intéressera principalement à deux des trois leviers mentionnés dans le cours:

* la complexité algorithmique
* les langages de programmation

Afin de mesurer l'efficacité énergétique d'un programme, on mesurera en premier lieu leur temps d'exécution. Comme indiqué par l'étude de [Pereira et al 2017,](https://dl.acm.org/doi/pdf/10.1145/3136014.3136031) il y a une forte corrélation entre le temps d'exécution d'un programme et sa consommation énergétique. On peut donc supposer en première approximation que :

$$
E(\text{programme}) \propto T_{\text{exécution}}
$$

### Mise en place du TP

* Ouvrir le Terminal.
* Créer un dossier associé à ce TP, avec la commande `mkdir` :
  ```
  mkdir Documents/EE_PC/
  ```
* se déplacer dans ce répertoire en faisant :
  ```
  cd Documents/EE_PC/
  ```
* Télécharger l'archive en exécutant la commande :
  ```
  wget https://rachddou.github.io/assets/files/TP_E1.tar.gz
  ```
* Décompresser l'archive
  ```
  tar -xzvf TP_E1.tar.gz
  ```
* se déplacer dans ce TP_E1:
  ```
  cd TP_E1/
  ```

Vous devriez avoir récupéré tous les fichiers utiles à ce TP.

Afin d'écrire et éditer des programmes informatiques, on utilisera un éditeur de texte le plus simple possible comme Notepadqq, ou Emacs, qui peuvent être lancés depuis le terminal grâce à la commande :

`emacs [nom du fichier]&`  ou `notepadqq [nom du fichier]&`

Ces programmes pourront être exécutés de différentes manières en fonction du langage de programmation, ce qu'on découvrira tout au long du TP.

---

## Partie 1 : Complexité Algorithmique

### Mise-en place pour python

Dans cette première partie, on codera les exercices en **python.**  Afin de créer un fichier python, lancez l'éditeur et enregistrer votre programme au format `.py`.

Pour exécuter le programme python sur les machines de l'école, il est nécessaire d'activer un environnement qui possède les bonnes librairies. Pour cela effectuer la commande:

```bash
source /opt/miniconda/bin/activate
conda activate ee_pc_E2
```

Pour exécuter le programme, rendez vous dans le terminal, et effectuer la commande:

```bash
python3 nom_du_fichier.py
```

Contrairement aux langages compilés, l'interpréteur de Python lit et exécute chaque ligne de code à la volée. Ce n'est pas optimal car le CPU effectue beaucoup de tâches de traduction.

###### PAS DE PANIQUE!
Si vous ne savez pas coder en `python`, les corrigés sont fournis dans l'archive avec l'extension `_corrigé.py`. Dans ce cas, vous devrez exécutez ces programmes. Cela ne vous empêche pas d'écrire le pseudo-code de l'algorithme à la main.

Pour ceux qui savent déjà coder en python, forcez vous à ne pas regarder le corrigé, c'est un bon exercice.
  


### Exercice 1 - la suite de Fibonacci

La suite de Fibonacci est une suite célèbre qui a été étudiée à la fois en mathématiques pour son lien avec le nombre d'or, et en algorithmique pour ses différentes implémentations. L'objectif de cet exercice est de programmer ces implémentations en Python et d'observer les comportements asymptotiques du temps de calcul (quand $n\rightarrow \infty$)

#### Définition de la suite de Fibonacci

La suite de Fibonacci est définie comme suit:

$$
F_0 = 1, F_1 = 1, \forall n \geq 2, F_n = F_{n-1} + F_{n-2}
$$

Cette suite est donc définie par une récurrence double. Comme vu dans le cours pour un autre exemple, on peut programmer cette fonction suivant deux fonctionnements différents :

* en *récursif:* en définissant une fonction qui s'appelle elle-même,
* en *itératif:* en utilisant une boucle FOR ou WHILE.

{% details Rappels de l'implémentation d'une fonction récursive %}

Une fonction récursive est une fonction qui s'appelle elle-même dans le corps de la fonction.

```python
def maFonctionRecursive(n):
    if n == 0:
        return 1
    else:
        return (2*maFonctionRecursive(n-1)+ 1)
```

{% enddetails %}

#### Questions

Placez vous dans le répertoire `TP_E1/exercice1/`.

**Question 1.1** : Dans le fichier `fibonacci_eleve.py`, remplissez le code la fonction itérative.

**Question 1.2** : Dans le fichier `fibonacci_eleve.py`, remplissez le code la fonction récursive.

**Question 1.3** : Testez cette fonction en changeant à la fois les valeurs de $n$ et de `mode`. Comment évolue le temps de calcul selon vous ?

**Question 1.4** : Afin de le vérifier, faites le calcul de la complexité sur papier, pour la version itérative.


**Question 1.5** : même chose pour la version récursive.


**Question 1.6**: Maintenant que votre implémentation fonctionne, illustrez le comportement que vous avez prédit en traçant le temps de calcul en fonction de $n$. Pour cela vous pouvez exécuter le fichier python `temps_fibonacci_courbe.py`. Vous pouvez visualiser le graphique avec une échelle linéaire ou une échelle logarithmique. Que nous indique le graphique en échelle logarithmique ?

**Question 1.7 (À FAIRE S'IL RESTE DU TEMPS EN FIN DE TP)** Il est possible d'écrire la fonction de Fibonacci en récursif tout en gardant une complexité linéaire. Ceci se fait par un procédé qu'on appelle mémoïsation, qui diminue le temps de calcul, au prix d'une occupation mémoire plus importante. Si vous avez le temps, créez une nouvelle fonction mémoïsée dans `fibonacci_eleve.py` avec les indices suivants.

{% details Indice 1 : principe de la mémoïsation %}
L'idée de la mémoïsation est de **mémoriser** les résultats déjà calculés dans une structure de données (un dictionnaire par exemple), afin de ne jamais recalculer deux fois la même valeur. Avant d'effectuer un appel récursif, commencez par vérifier si le résultat est déjà connu ; si oui, retournez-le directement sans récursion.

Combien d'appels distincts sont effectués pour calculer $F_n$ avec cette approche ?
{% enddetails %}

{% details Indice 2 : analyse de la complexité %}
Avec la mémoïsation, chaque valeur $F_k$ pour $k \in \{0, \ldots, n\}$ est calculée **exactement une fois**. Le calcul de chaque $F_k$ prend un temps constant (une addition et une visite du dictionnaire). Quelle est donc la complexité en temps ? Et en mémoire ?
{% enddetails %}

### Exercice 2

Étant donné une liste de $n$ entiers et une valeur cible $v$, on cherche à déterminer si $v$ est présente dans la liste, et si oui, à quel index.

On va comparer deux approches :

- *la recherche linéaire :* on parcourt la liste de gauche à droite,
- *la recherche dichotomique :* on divise l'intervalle de recherche par deux à chaque étape (nécessite une liste triée).

{% details Rappel sur les listes triées %}
Une liste est dite triée si ses éléments sont rangés dans l'ordre croissant :

```python
liste_triee = [2, 5, 8, 12, 16, 23, 38, 42]
```

Pour trier une liste en Python : `liste.sort()` ou `sorted(liste)`.
{% enddetails %}

#### Questions

Placez vous dans le répertoire `TP_E1/exercice2/`.

**Question 2.1 :** Dans le fichier `recherche_eleve.py,` remplissez le blocs de code correspondant à la recherche linéaire.

**Question 2.2 :** Dans le fichier `recherche_eleve.py,` remplissez le blocs de code correspondant à la recherche dichotomique.

**Question 2.3 :** Testez ces fonctions sur des listes de tailles variées, en cherchant un élément présent et un élément absent. Qu'observez-vous sur le temps de calcul ?

**Question 2.4 :** Calculez sur papier la complexité de la recherche linéaire dans le pire des cas. 

**Question 2.5 :** 
Même chose pour la recherche dichotomique, exprimez le nombre maximal d'étapes en fonction de $n$.

{% details Indice pour le calcul de la complexité de la recherche dichotomique: %}

Soit $T(n)$ le nombre d'étape dans le pire des cas pour trouver notre élément. A chaque étape,
on divise l'intervalle de recherche par 2, et on effectue une comparaison. On a donc la relation par récurrence suivante:
$T(n) = 1+ T(n/2) $
En poussant la récurrence on a donc $T(n) = k +  T(\frac{n}{2^k})$. L'algorithme s'arrête lorsque $\frac{n}{2^k} = 1$.
 Poursuivez le raisonnement pour trouver une formulation explicite de $k_{final}$ en fonction de $n$ et donc de $T(n)$.

{% enddetails %}

**Question 2.6 :** Illustrez ce comportement en exécutant `temps_recherche_courbe.py`, qui trace le temps de calcul en fonction de $n$ pour les deux algorithmes. Le comportement asymptotique trouvé dans la question précédente est-il vérifié par cette expérience?

**Question 2.7 (À FAIRE S'IL RESTE DU TEMPS EN FIN DE TP) :** La recherche dichotomique suppose que la liste est triée. Quel est le coût du tri préalable ? Dans quel cas est-il rentable de trier la liste avant de faire des recherches ? Formulez une condition sur le nombre de recherches $q$ et la taille $n$ pour que l'approche "trier puis chercher" soit plus efficace que la recherche linéaire répétée.

{% details Indice : mise en place du raisonnement %}
Notons $q$ le nombre de recherches à effectuer sur une liste de taille $n$. On cherche à comparer le coût total de deux stratégies :

- **Stratégie A** — recherche linéaire répétée : chaque recherche coûte $O(n)$, donc le coût total pour $q$ recherches est $O(q \cdot n)$.
- **Stratégie B** — trier puis chercher en dichotomique : le tri coûte $O(n \log n)$, et chaque recherche dichotomique coûte $O(\log n)$, donc le coût total est $O(n \log n + q \cdot \log n)$.

La stratégie B devient rentable lorsque son coût total est inférieur à celui de la stratégie A. Écrivez cette inégalité, puis simplifiez-la pour isoler $q$ en fonction de $n$.
{% enddetails %}

---

## Partie 2 — Comparaison des langages de programmation

Les performances d'un programme dépendent non seulement de l'algorithme choisi, mais aussi du langage utilisé. Un langage **compilé** comme le C produit directement du code machine, tandis qu'un langage **interprété** comme Python passe par un interpréteur à chaque instruction. Java offre un compromis : le code source est d'abord compilé en **bytecode**, un langage intermédiaire indépendant de la machine, qui est ensuite exécuté par une machine virtuelle (la **JVM**, Java Virtual Machine).

Dans cette partie, l'idée est de tester des programmes déjà écrits en Java, C et Python, et de se familiariser avec la compilation.

### Exercice 3 — Somme de 1 à n

On cherche à calculer la somme $S = \sum_{i=1}^{n} i$ avec une boucle explicite, sans utiliser de formule mathématique.

Placez vous dans le répertoire `TP_E1/exercice3/`.

**Question 3.1** : Lisez les fichiers `exercice3/somme.c`, `exercice3/Somme.java` et `exercice3/somme.py`.

Pour chacun de ces langages le mode d'exécution est différent.
Vous savez déjà comment exécuter un code en python, donc voici des informations sur le mode d'exécution pour C et JAVA.

{% details **A LIRE : Commandes de compilation et d'exécution pour le langage C**%}
Afin d'exécuter un programme écrit en C, il faut dans un premier temps le **compiler**, ce qui va traduire le code source C en langage machine, sous la forme d'un fichier binaire exécutable. La compilation est effectuée par le compilateur GNU C, que l'on appelle avec la commande `gcc`. Afin de créer un fichier exécutable, on écrit dans le terminal :

```bash
gcc somme.c -o somme.exe
```

et pour l'exécuter :

```bash
./somme.exe 10000
```

`gcc` accepte de nombreuses options qui permettent de contrôler la compilation. Les plus utiles sont :

| Option            | Effet                                                                |
| ----------------- | -------------------------------------------------------------------- |
| `-o nom`        | Spécifie le nom du fichier de sortie (par défaut `a.out`)        |
| `-O0`           | Désactive les optimisations (utile pour le débogage)               |
| `-O2` / `-O3` | Active des optimisations agressives pour améliorer les performances |
| `-Wall`         | Affiche tous les avertissements courants                             |
| `-g`            | Inclut les informations de débogage dans l'exécutable              |

Par exemple, pour compiler avec tous les warnings activés :

```bash
gcc -Wall -o somme.exe somme.c
```

Plus de détails sur la compilation seront donnés dans le TP C1.
{% enddetails %}

{% details **A LIRE : Commandes de compilation et d'exécution pour Java**%}

Afin d'exécuter un programme écrit en Java, il faut également passer par une étape de compilation. Contrairement au C, le compilateur Java ne produit pas directement du code machine : il génère du **bytecode**, un format intermédiaire interprété par la machine virtuelle Java (JVM). C'est ce mécanisme qui permet à Java d'être portable ("Write Once, Run Anywhere"). La compilation est effectuée avec la commande `javac`. Pour compiler le fichier `Somme.java`, on écrit dans le terminal :

```bash
javac Somme.java
```

Cela génère un fichier `Somme.class` contenant le bytecode. Pour l'exécuter avec la JVM :

```bash
java Somme 1000
```

Notez qu'on ne précise pas l'extension `.class`, et que le nom de la classe doit correspondre exactement au nom du fichier source.

{% enddetails %}

**Question 3.2** : Compilez les programmes avec les instructions données précédemment.
Exécutez les trois programmes en testant différentes valeurs de n.
Exécutez les trois programmes avec $n = 10^9$. Relevez les temps d'exécution.

| Langage | Temps (s) | Rapport vs C |
| ------- | --------- | ------------ |
| C       |           | 1×          |
| Java    |           |              |
| Python  |           |              |

**Question 3.3** : Calculez sur papier la complexité de cet algorithme. Est-elle identique dans les trois langages ? Si les complexités sont les mêmes, comment expliquez-vous les différences de temps mesurées ?

**Question 3.4**: Les résultats que vous avez obtenus contredisent ceux avancés par l'étude de 2017. On voit en effet que pour ce programme Java produit des résultats plus rapides que C. Ceci est causé par une **optimisation défaillante** : par défaut, `gcc` compile sans optimisation (`-O0`), ce qui signifie que le code machine généré est naïf et non optimisé. La JVM Java, en revanche, applique automatiquement une compilation JIT(just-in) qui optimise le code à l'exécution. Pour rétablir l'avantage du C, recompilez avec l'option `-O2` :

```bash
gcc -O2 -o somme.exe somme.c
```

Vous devriez constater que C redevient plus rapide que Java. Ceci illustre l'importance du niveau d'optimisation lors de la compilation, et explique pourquoi les benchmarks de l'étude de Pereira et al. sont réalisés avec des optimisations activées.

{% details **Ce qu'active -O2 : focus sur l'allocation de registres** %}
L'option `-O2` active un ensemble d'optimisations automatiques parmi lesquelles l'une des plus impactantes est l'**allocation de registres**.

Un processeur dispose d'un petit nombre de registres (typiquement 16 sur x86-64), qui sont des emplacements mémoire intégrés directement dans le CPU. Accéder à un registre est **des dizaines à des centaines de fois plus rapide** qu'accéder à la RAM. Sans optimisation (`-O0`), `gcc` stocke naïvement toutes les variables en mémoire, ce qui génère de nombreux allers-retours inutiles entre la RAM et le CPU. Avec `-O2`, le compilateur analyse quelles variables sont utilisées fréquemment et les maintient dans des registres aussi longtemps que possible.

Dans le cas d'un programme aussi simple que la somme de 1 à $n$, l'accumulateur et le compteur de boucle peuvent tenir entièrement dans des registres, éliminant quasiment tous les accès mémoire. C'est précisément ce que fait le JIT de Java automatiquement, d'où son avantage apparent sur un C compilé sans optimisation.

Parmi les autres optimisations activées par `-O2`, on trouve :

- **le déroulage de boucles** (*loop unrolling*) : réduire le nombre d'itérations en effectuant plusieurs opérations par tour,
- **l'inlining** : remplacer un appel de fonction par le corps de la fonction directement,
- **l'élimination des sous-expressions communes** : ne calculer qu'une seule fois une expression répétée.
  {% enddetails %}

---

### Exercice 4 — Pourquoi Python est-il si lent?

Dans cet exercice, le but est d'illustrer une première raison pour laquelle Python est aussi peu efficace par rapport à C. On commencera par regarder ce qu'il se cache derrière un simple entier en Python.

En C, un entier est un type **primitif**: il occupe un espace mémoire fixe, déterminé à la compilation. En Python, tout est objet : même un simple entier embarque des métadonnées (type, compteur de références, valeur), ce qui augmente considérablement son empreinte mémoire.

Placez vous dans le répertoire `TP_E1/exercice4/`

**Question 4.1**

Exécutez le programme Python suivant et relevez les tailles affichées.

```python
import sys

print(sys.getsizeof(0))
print(sys.getsizeof(1))
print(sys.getsizeof(1000))
print(sys.getsizeof(10**100))

```

Que remarquez-vous sur la taille des petits entiers ? Et sur la taille de `10**100` ? Qu'est-ce que cela indique sur la représentation des entiers en Python ?

**Question 4.2**

Compilez et exécutez le fichier C suivant.

```C
// fichier: taille_int.c
#include <stdio.h>

int main() {
    printf("taille d'un char   : %zu octets\n", sizeof(char));
    printf("taille d'un short  : %zu octets\n", sizeof(short));
    printf("taille d'un int    : %zu octets\n", sizeof(int));
    printf("taille d'un long   : %zu octets\n", sizeof(long));
    printf("taille d'un double : %zu octets\n", sizeof(double));
    return 0;
}
```

Comparez les tailles obtenues avec celles de la Question 1. Que fait ce code?
Quelle différence fondamentale observez-vous entre les entiers C et les entiers Python ?

**Question 4.3**
Maintenant essayons de stocker `10**20` dans un entier de type long. Compilez le code suivant:

```C
#include <stdio.h>

int main() {
    long x = 100000000000000000000L; // 10^20
    printf("x = %ld\n", x);
    return 0;
}
```

Le compilateur vous indique un Warning concernant la taille de l'entier. Que se passe-t-il à l'exécution de ce programme ? Contrairement à Python, la taille mémoire allouée à notre variable `x` est déterminée par le type `long`. Si la valeur qu'on souhaite lui donner est supérieure à ce que ce type peut encoder, un phénomène **d'overflow**(dépassement) survient. Le nombre en sortie ne correspond donc pas à la valeur donnée mais:

$$
x \mod 2^{n_{\text{bits}}(\text{long})}
$$

Python est donc un langage plus permissif, au prix de performances inférieures, comme on a pu le voir sur les temps de calcul.

**Question 4.4 :**
Exécutez le programme suivant qui compare l'empreinte mémoire d'une liste de $10^6$
entiers en Python et d'un tableau équivalent en C via NumPy.

NumPy est une bibliothèque Python dont le cœur est écrit en C. Lorsque vous appelez une fonction NumPy, Python délègue le calcul à une fonction C compilée qui opère directement sur un bloc mémoire continu et typé, sans créer d'objets Python intermédiaires. Un tableau NumPy n'est donc qu'une adresse vers un tableau C, d'où une empreinte mémoire et des performances proches du C— contrairement à une liste Python où chaque élément est un objet indépendant avec ses propres métadonnées.

```python
import sys
import numpy as np

n = 1_000_000

# Côté Python
liste = list(range(n))
taille_objets = sum(sys.getsizeof(x) for x in liste)
taille_liste  = sys.getsizeof(liste)
taille_totale = taille_objets + taille_liste

# Côté C (via NumPy qui utilise des int32 comme C)
tableau = np.arange(n, dtype=np.int32)
taille_numpy = tableau.nbytes

print(f"Liste Python  : {taille_totale  / 1024**2:.1f} Mo")
print(f"Tableau NumPy : {taille_numpy   / 1024**2:.1f} Mo")
print(f"Rapport       : {taille_totale / taille_numpy:.1f}x")
```

Calculez maintenant le rapport théorique attendu à partir des tailles mesurées en Question 1 et Question 2. Correspond-il au rapport observé ?

{% details Indice : calcul du rapport théorique %}
Une liste Python de $n$ éléments occupe deux types de mémoire : les **objets entiers** eux-mêmes (dont vous avez mesuré la taille en Q1), et un tableau de **pointeurs** vers ces objets (dont vous avez vu la taille en Q2 avec `long`). Additionnez ces deux contributions par élément, et divisez par la taille d'un `int32` NumPy.

Un **pointeur** est une variable qui stocke l'**adresse mémoire** d'une autre valeur, plutôt que la valeur elle-même :

```
Liste Python : [ ptr0 | ptr1 | ptr2 | ... ]
                  |       |       |
                  ▼       ▼       ▼
               [obj0]  [obj1]  [obj2]   ← objets éparpillés en mémoire

Tableau NumPy : [ 0 | 1 | 2 | 3 | ... ] ← valeurs entières bout à bout
```
{% enddetails %}



**Question 4.5 :**
Le rapport observé en Question 4 correspond donc bien au rapport théorique issu des tailles mesurées en Questions 1 et 2 : la différence de mémoire occupée s'explique entièrement par la taille des objets Python (28 octets) par rapport aux entiers C (4 octets).

Il existe cependant un surcoût supplémentaire lié au fonctionnement du CPU. Celui-ci charge les données en mémoire par blocs de 64 octets, appelés **lignes de cache**. Pour un tableau NumPy (ou un tableau C), les entiers sont stockés de manière **contiguë** : 16 entiers de 4 octets tiennent dans une ligne de cache. En revanche, une liste Python stocke un tableau de **pointeurs** (8 octets chacun), chaque pointeur renvoyant vers un objet Python situé à un emplacement arbitraire en mémoire. Parcourir la liste implique donc deux niveaux d'accès mémoire : d'abord le tableau de pointeurs, puis une déréférence pour chaque objet. Ces accès indirects provoquent des **défauts de cache** fréquents, venant s'ajouter au surcoût mémoire déjà observé.

Combien d'entiers C (4 octets) et combien de pointeurs (8 octets) tiennent dans une ligne de cache ? En déduire le nombre minimal de chargements mémoire pour parcourir $10^6$ éléments dans chaque cas.

<!-- ### Exercice 4 — Tri fusion (Merge Sort)

Le tri fusion est un algorithme de tri récursif de complexité $O(n \log n)$. Son principe est le suivant :

* si la liste contient moins de 2 éléments, elle est déjà triée,
* sinon, on la coupe en deux moitiés, on trie chaque moitié récursivement, puis on **fusionne** les deux moitiés triées.

{% details Rappel sur la fusion de deux listes triées %}

Fusionner deux listes triées $L$ et $R$ consiste à construire une nouvelle liste triée en comparant à chaque étape le premier élément de $L$ et le premier élément de $R$, et en prenant le plus petit :

```
L = [1, 4, 7]     R = [2, 3, 8]
→ on compare 1 et 2 : on prend 1
→ on compare 4 et 2 : on prend 2
→ on compare 4 et 3 : on prend 3
→ on compare 4 et 8 : on prend 4
→ ...
résultat : [1, 2, 3, 4, 7, 8]
```

{% enddetails %}

**Question 1** : Lisez les fichiers `exercice4/mergesort.c`, `exercice4/MergeSort.java` et `exercice4/mergesort.py`. Compilez ces programmes si besoin, et vérifiez que les trois programmes trient correctement une liste de 10 éléments.

**Question 2** : Exécutez les trois programmes avec $n = 10^6$ éléments générés aléatoirement. Relevez les temps d'exécution et remplissez le tableau suivant :

| Langage | Temps (s) | Rapport vs C |
| ------- | --------- | ------------ |
| C       |           | 1×          |
| Java    |           |              |
| Python  |           |              |

**Question 3** : Comparez les rapports obtenus ici avec ceux de l'exercice 3. L'écart entre les langages est-il plus grand ou plus petit ? Proposez une explication en lien avec la nature des opérations effectuées dans chaque algorithme.

**Question 4** : Calculez sur papier la complexité en temps et en mémoire du tri fusion. Pourquoi dit-on que le tri fusion n'est pas **en place** ? Quel est le coût mémoire supplémentaire par rapport à un tri en place comme le tri rapide ?

**Question 5 (À FAIRE S'IL RESTE DU TEMPS EN FIN DE TP)** : Modifiez les trois programmes pour faire varier $n$ de $10^3$ à $10^6$ et tracez les temps d'exécution en fonction de $n$ sur un graphique log-log. Que doit-on observer sur la pente des courbes ? Les trois langages donnent-ils des pentes identiques ? -->
