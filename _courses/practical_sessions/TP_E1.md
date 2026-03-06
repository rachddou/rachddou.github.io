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

Afin de mesurer l'efficacité énergétique d'un programme, on mesurera en premier lieu leur temps d'exécution. Comme indiqué par l'étude de [Pereira et al 2017,](https://dl.acm.org/doi/pdf/10.1145/3136014.3136031) il y a une forte corrélation entre le temps d'éxécution d'un programme et sa consommation énergétique. On peut donc supposer en première approximation que :

$$
E(\text{programme}) \propto T_{\text{exécution}}
$$

### Mise en place du TP

* Ouvrir le Terminal.
* Créer un dossier associé à ce TP, avec la commande `mkdir` :
  ```
  mkdir Documents/EE_PC/TP_E1/
  ```
* se déplacer dans le ce répértoire en faisant:
  ```
  cd Documents/EE_PC/TP_E1/
  ```
* Télécharger l'archive en éxecutant la commande :
  ```
  wget lien.tar
  ```
* Décompresser l'archive
  ```
  tar -xzvf lien.tar
  ```

Vous devriez avoir récupéré tous les fichiers utiles à ce TP.

Afin d'écrire et éditer des programmes informatiques, on utilisera un éditeur de texte le plus simple possible comme Notepadqq, ou Emacs, qui peuvent être lancés depuis le terminal grace à la commande:

`emacs [nom du fichier]&`  ou `notepadqq [nom du fichier]&`

Ces programmes pourront être exécuté de différente manière en fonction du langage de programmation, ce qu'on découvrira tout au long du TP.

---

## Partie 1 : Complexité Algorithmique

### Mise-en place pour python

Dans cette première partie, on codera les exercices en **python.**  Afin de créer un fichier python, lancez l'éditeur et enregistrer votre programme au format `.py`.

Pour exécuter le programme, rendez vous dans le terminal, et effectuer la commande:

```
python3 nom_du_fichier.py
```

Contrairement aux langages compilés, l'interpréteur de python lit et éxecute chaque ligne de code à la volée. Ce n'est pas optimal car le CPU effectue beaucoup de tâche de traductions.

### Exercice 1 - la suite de Fibonnaci

La suite de Fibonnaci est une suite célèbre qui a été étudiée à la fois en mathématiques pour son lien avec le nombre d'or, et en algorithmique pour ses différentes implémentations. L'objectif de cet exercice est de programmer ces implémentations en python et d'observer les comportements asymptotiques du temps de calcul (quand $n\rightarrow \infty$)

#### Définition de la suite de Fibonnaci

La suite de Fibonnaci est définie comme suit:

$$
F_0 = 1, F_1 = 1, \forall n \geq 2, F_n = F_{n-1} + F_{n-2}
$$

Cette suite est donc définie par une récurrence double. Comme vu dans le cours pour un autre exemple, on peut utiliser programmer cette fonction suivant deux fonctionnement différents:

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

**Question 1**: Dans le fichier fibonnaci_eleve.py, remplissez les blocs de code correspondant à la version récursive et à la version itérative.

**Question 2**: Tester cette fonction en changeant à la fois les valeurs de $n$ et de `mode`. Comment évolue le temps de calcul selon vous?

**Question 3**: Afin de le vérifier, faites le calcul de la complexité sur papier. Quelle complexité obtient on?

**Question 4**: Maintenant que votre implémentation fonctionne, illustrez le comportement que vous avez prédit en tracant le temps de calcul en fonction de $n$. Pour cela vous pouvez exécuter le fichier python `temps_fibonnaci_courbe.py`. Vous pouvez visualiser le graphique avec une échelle linéaire ou une échelle logarithmique. Que nous indique le graphique en échelle logarithmique?

**Question 5 (A FAIRE SI IL RESTE DU TEMPS EN FIN DE TP)** Il est possible d'écrire la fonction de Fibonnaci en récursif tout en gardant une complexité linéaire. Ceci se fait par un procédé qu'on appelle mémoïsation, qui diminue le temps de calcul, au prix d'une occupation mémoire plus importante.

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

**Question 1 :** Dans le fichier `exercice2/echerche_eleve.py,` remplissez les blocs de code correspondant à la recherche linéaire et à la recherche dichotomique.

**Question 2 :** Testez ces fonctions sur des listes de tailles variées, en cherchant un élément présent et un élément absent. Qu'observez-vous sur le temps de calcul ?

**Question 3 :** Calculez sur papier la complexité des deux algorithmes dans le pire des cas. Pour la recherche dichotomique, exprimez le nombre maximal d'étapes en fonction de $n$.

{% details Indice pour le calcul de la complexité de la recherche dichotomique:%}
Soit $T(n)$ le nombre d'étape dans le pire des cas pour trouver notre élément. A chaque étape,
on divise l'intervalle de recherche par 2, et on effectue une comparaison. On a donc la relation par récurrence suivante:
$$T(n) = 1+ T(n/2)$$. En poussant la récurrence on a donc $$T(n) = k + T
frac{n}{2^k}$$. L'algorithme s'arrête lorsque $frac{n}{2^k} = 1$ Poursuivez le raisonnement pour trouver une formulation explicite de $T(n)$.
{% enddetails %}


**Question 4 :** Illustrez ce comportement en exécutant temps_recherche_courbe.py, qui trace le temps de calcul en fonction de $n$ pour les deux algorithmes. Que nous indique le graphique en échelle logarithmique ? Quelle est la différence entre une droite de pente 1 et une droite de pente inférieure à 1 sur ce graphique ?

**Question 5 (À FAIRE S'IL RESTE DU TEMPS EN FIN DE TP) :** La recherche dichotomique suppose que la liste est triée. Quel est le coût du tri préalable ? Dans quel cas est-il rentable de trier la liste avant de faire des recherches ? Formulez une condition sur le nombre de recherches qq
q et la taille $n$ pour que l'approche "trier puis chercher" soit plus efficace que la recherche linéaire répétée.

---

## Partie 2 — Comparaison des langages de programmation

Les performances d'un programme dépendent non seulement de l'algorithme choisi, mais aussi du langage utilisé. Un langage **compilé** comme le C produit directement du code machine, tandis qu'un langage **interprété** comme Python passe par une interpréteur à chaque instruction. Java offre un compromis : le code source est d'abord compilé en **bytecode**, un langage intermédiaire indépendant de la machine, qui est ensuite exécuté par une machine virtuelle (la **JVM**, Java Virtual Machine).

Dans cette partie, l'idée est de tester des programmes déjà écrit en Java, C et python, et de se familiariser avec la compilation.

### Exercice 3 — Somme de 1 à n

On cherche à calculer la somme $S = \sum_{i=1}^{n} i$ avec une boucle explicite, sans utiliser de formule mathématique.

**Question 1** : Lisez les fichiers `exercice3/somme.c`, `exercice3/Somme.java` et `exercice3/somme.py`.

Pour chacun de ces langages le mode d'exécution est différent.
Vous savez déjà comment exécuter un code en python, donc voici des informations sur le mode d'exécution pour C et JAVA.

{% details Commandes de compilation et d'éxecution pour le langage C%}
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

Par exemple, pour compiler avec optimisations maximales :

```bash
gcc -O3 -o somme.exe somme.c
```
Plus de détails sur la compilation seront donnés dans le TP C1.
{% enddetails %}

{% details Commandes de compilation et d'éxecution pour java%}
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

**Question 2** : Compilez les programmes avec les instructions données précedemment.
Exécutez les trois programmes en testant différentes valeurs de n.
Exécutez les trois programmes avec $n = 10^9$. Relevez les temps d'exécution.

| Langage | Temps (s) | Rapport vs C |
| ------- | --------- | ------------ |
| C       |           | 1×          |
| Java    |           |              |
| Python  |           |              |

**Question 3** : Calculez sur papier la complexité de cet algorithme. Est-elle identique dans les trois langages ? Si les complexités sont les mêmes, comment expliquez-vous les différences de temps mesurées ?

**Question 4**: Les résultats que vous avez obtenu contredisent ceux avancés par l'étude de 2017. On voit en effet que pour ce programme Java produit des résultats plus rapides que C. Ceci est causé par une **optimisation défaillante** : par défaut, `gcc` compile sans optimisation (`-O0`), ce qui signifie que le code machine généré est naïf et non optimisé. La JVM Java, en revanche, applique automatiquement une compilation JIT qui optimise le code à l'exécution. Pour rétablir l'avantage du C, recompilez avec l'option `-O2` :

```bash
gcc -O2 -o somme.exe somme.c
```

Vous devriez constater que C redevient nettement plus rapide que Java. Ceci illustre l'importance du niveau d'optimisation lors de la compilation, et explique pourquoi les benchmarks de l'étude de Pereira et al. sont réalisés avec des optimisations activées.

{% details Ce qu'active -O2 : focus sur l'allocation de registres %}
L'option `-O2` active un ensemble d'optimisations automatiques parmi lesquelles l'une des plus impactantes est l'**allocation de registres**.

Un processeur dispose d'un petit nombre de registres (typiquement 16 sur x86-64), qui sont des emplacements mémoire intégrés directement dans le CPU. Accéder à un registre est **des dizaines à des centaines de fois plus rapide** qu'accéder à la RAM. Sans optimisation (`-O0`), `gcc` stocke naïvement toutes les variables en mémoire, ce qui génère de nombreux allers-retours inutiles entre la RAM et le CPU. Avec `-O2`, le compilateur analyse quelles variables sont utilisées fréquemment et les maintient dans des registres aussi longtemps que possible.

Dans le cas d'un programme aussi simple que la somme de 1 à $n$, l'accumulateur et le compteur de boucle peuvent tenir entièrement dans des registres, éliminant quasiment tous les accès mémoire. C'est precisément ce que fait le JIT de Java automatiquement, d'où son avantage apparent sur un C compilé sans optimisation.

Parmi les autres optimisations activées par `-O2`, on trouve :

- **le déroulage de boucles** (*loop unrolling*) : réduire le nombre d'itérations en effectuant plusieurs opérations par tour,
- **l'inlining** : remplacer un appel de fonction par le corps de la fonction directement,
- **l'élimination des sous-expressions communes** : ne calculer qu'une seule fois une expression répétée.
  {% enddetails %}

---

### Exercice 4 — Tri fusion (Merge Sort)

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

**Question 5 (À FAIRE S'IL RESTE DU TEMPS EN FIN DE TP)** : Modifiez les trois programmes pour faire varier $n$ de $10^3$ à $10^6$ et tracez les temps d'exécution en fonction de $n$ sur un graphique log-log. Que doit-on observer sur la pente des courbes ? Les trois langages donnent-ils des pentes identiques ?
