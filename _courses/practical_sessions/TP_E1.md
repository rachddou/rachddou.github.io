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

Afin de mesurer l'efficacité énergétique d'un programme, on mesurera le temps d'exécution de nos programmes ainsi que la mémoire utilisée. Comme indiqué par l'étude de [Pereira et al 2017,](https://dl.acm.org/doi/pdf/10.1145/3136014.3136031) il y a une forte corrélation entre le temps d'éxécution et la consommation énergétique. On peut donc supposer en première approximation que :

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

Afin d'écrire des programmes informatiques, on utilisera un éditeur de texte le plus simple possible comme Notepad++, ou Emacs, qui peuvent être lancer depuis le terminal grace à la commande:

`emacs&`  ou `notepad++&`

Ces programmes pourront être exécuté de différente manière en fonction du langage de programmation, ce qu'on découvrira tout au long du TP.

## Partie 1 : Complexité Algorithmique

### mise-en place pour python

Dans cette première partie, on codera les exercices en **python.**  Afin de créer un fichier python, lancez l'éditeur et enregistrer votre programme au format `.py`.

Pour exécuter le programme rendez vous dans le terminal, et effectuer la commande:

```
python3 nom_du_fichier.py
```

Contrairement aux langages compilés / semi-compilés, l'interpréteur de python lit et éxecute chaque ligne de code à la volée. Ce n'est pas optimal car le CPU effectue beaucoup de tâche de traduction.

### Exercice 1 - la suite de Fibonnaci

La suite de Fibonnaci est une suite célèbre qui a été étudiée à la fois en mathématiques pour son lien avec le nombre d'or, et en algorithmique pour ses différentes implémentations. L'objectif de cet exercice est de programmer ces implémentations en python et d'observer les comportements asymptotiques du temps de calcul (quand $n\rightarrow \infty$)

#### Définition de la suite de Fibonnaci

La suite de Fibonnaci est définie comme suit:

$$
F_0 = 1, F_1 = 1, \forall n \geq 2, F_n = F_{n-1} + F_{n+2}
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

**Question 1 :** Dans le fichier recherche_eleve.py, remplissez les blocs de code correspondant à la recherche linéaire et à la recherche dichotomique.
**Question 2 :** Testez ces fonctions sur des listes de tailles variées, en cherchant un élément présent et un élément absent. Qu'observez-vous sur le temps de calcul ?
**Question 3 :** Calculez sur papier la complexité des deux algorithmes dans le pire des cas. Pour la recherche dichotomique, exprimez le nombre maximal d'étapes en fonction de $n$.
**Question 4 :** Illustrez ce comportement en exécutant temps_recherche_courbe.py, qui trace le temps de calcul en fonction de $n$ pour les deux algorithmes. Que nous indique le graphique en échelle logarithmique ? Quelle est la différence entre une droite de pente 1 et une droite de pente inférieure à 1 sur ce graphique ?

**Question 5 (À FAIRE S'IL RESTE DU TEMPS EN FIN DE TP) :** La recherche dichotomique suppose que la liste est triée. Quel est le coût du tri préalable ? Dans quel cas est-il rentable de trier la liste avant de faire des recherches ? Formulez une condition sur le nombre de recherches qq
q et la taille nn
n pour que l'approche "trier puis chercher" soit plus efficace que la recherche linéaire répétée.
