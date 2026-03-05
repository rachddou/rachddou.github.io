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

```python
def maFonctionRecursive(n):
    if n == 0:
        return 1
    else:
        return (2*maFonctionRecursive(n-1)+ 1)
```

{% enddetails %}
