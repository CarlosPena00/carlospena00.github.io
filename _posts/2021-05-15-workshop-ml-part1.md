---
layout: post
title: "Workshop: Machine Learning - Part 1 - Classification"
author: Carlos Pena
date: 2021-05-15
---

This post is a conversion from an old workshop of mine.
For a better view, please check the [notebook](https://github.com/CarlosPena00/Workshops/blob/main/MachineLearning/0.libs-data-models.ipynb).

<h1> Part One - Theory</h1>

```python
#General Purpose
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

#Data transform
from sklearn.utils import resample
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.preprocessing import LabelEncoder
from sklearn.preprocessing import MinMaxScaler
from sklearn.preprocessing import Normalizer
from sklearn.manifold import TSNE

#Model
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.tree import export_text

#Metrics
from sklearn.metrics import accuracy_score, classification_report
from sklearn.metrics import f1_score, confusion_matrix, matthews_corrcoef

# Sample Datasets
from sklearn.datasets import load_iris

sns.set_theme()
```

# Dataset


```python
iris         = load_iris()
iris_data    = iris.data
iris_target  = iris.target
iris_targ_n  = iris['target_names']
iris_targ_n  = iris_targ_n[iris.target]
iris_feat_n  = iris['feature_names']

df = pd.DataFrame(iris_data, columns=iris_feat_n)
df['target'] = iris_targ_n
df.head()
```

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }
</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>sepal length (cm)</th>
      <th>sepal width (cm)</th>
      <th>petal length (cm)</th>
      <th>petal width (cm)</th>
      <th>target</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>5.1</td>
      <td>3.5</td>
      <td>1.4</td>
      <td>0.2</td>
      <td>setosa</td>
    </tr>
    <tr>
      <th>1</th>
      <td>4.9</td>
      <td>3.0</td>
      <td>1.4</td>
      <td>0.2</td>
      <td>setosa</td>
    </tr>
    <tr>
      <th>2</th>
      <td>4.7</td>
      <td>3.2</td>
      <td>1.3</td>
      <td>0.2</td>
      <td>setosa</td>
    </tr>
    <tr>
      <th>3</th>
      <td>4.6</td>
      <td>3.1</td>
      <td>1.5</td>
      <td>0.2</td>
      <td>setosa</td>
    </tr>
    <tr>
      <th>4</th>
      <td>5.0</td>
      <td>3.6</td>
      <td>1.4</td>
      <td>0.2</td>
      <td>setosa</td>
    </tr>
  </tbody>
</table>
</div>




```python
axes = df.boxplot(column=[iris_feat_n[0], iris_feat_n[2], iris_feat_n[1], iris_feat_n[3]],
                  by='target', figsize=(10, 10), fontsize=15)
```



![png](../../../assets/images/workshops/output_4_0.png)




```python
np.random.seed(2021)

tsne = TSNE(n_components=2, verbose=0, perplexity=40, n_iter=300)
tsne_results = tsne.fit_transform(iris_data)

df['tsne0'] = tsne_results[:, 0]
df['tsne1'] = tsne_results[:, 1]

plt.figure(figsize=(10,10))
sns.scatterplot( x="tsne0", y="tsne1", hue="target",
    palette=sns.color_palette("hls", 3), data=df,
    legend="full", alpha=1);
```



![png](../../../assets/images/workshops/output_5_0.png)



# Models

> ### “A computer program is said to learn from experience E with respect to some class of tasks T and performance measure P, if its performance at tasks in T, as measured by P, improves with experience E.” - Tom Mitchell

> Dado uma tarefa T medida por uma métrica P, se a métrica P melhorar com a experiência E é dito que o modelo aprendeu.

> Dado a tarefa (classificação entre gato-cachorro) e uma métrica (taxa de acerto), se a métrica (taxa de acerto) melhorar com a experiência (fotos de gatos-cachorros) é dito que o modelo aprendeu.

## K-Nearest Neighbors
![k1](../../../assets/images/workshops/knn_1_15_zoom.png)
<img align="left" src="../../../assets/images/workshops/knn_map.png" width="100%">


## Árvore de decisão (Decision tree)

<div>
<img align="left" src="../../../assets/images/workshops/tree2.png" width="50%">
</div>


![tree1](../../../assets/images/workshops/tree1.png)
```python
decision_tree = DecisionTreeClassifier(random_state=2021, max_depth=3)
decision_tree = decision_tree.fit(iris_data, iris_target)
r = export_text(decision_tree, feature_names=iris['feature_names'])
```

# Metrics


<img src="../../../assets/images/workshops/cm.png" width="100%">
Source: https://en.wikipedia.org/wiki/Confusion_matrix


```python
np.random.seed(2021)
has_cancer = (np.random.random(size=1000) > 0.9).astype(int)
predicted  = (np.random.random(size=1000) > 0.99).astype(int)#np.zeros(shape=1000, dtype=int)

cm = confusion_matrix(has_cancer, predicted)

df_cm = pd.DataFrame(cm, index = ["Actual Positive", "Actual Negative"],
                      columns = ["Predict Positive", "Predict Negative"])
plt.figure(figsize = (8,8))
axes = sns.heatmap(df_cm, annot=True, fmt='g', annot_kws={"size": 25})
plt.show()

accuracy = accuracy_score(has_cancer, predicted)
f1       = f1_score(has_cancer, predicted)
mcc      = matthews_corrcoef(has_cancer, predicted)
print(f"Results: Accuracy {accuracy:0.3f}\n         F1       {f1:0.3f}",
      f"\n         MCC     { mcc:0.3f}")

    Results: Accuracy 0.906
             F1       0.021
             MCC     -0.000
```



![png](../../../assets/images/workshops/output_12_0.png)


# Part Two - Practice

> ### [UCI Machine Learning Repository: Iris](https://archive.ics.uci.edu/ml/datasets/Iris)
> ###  [Kaggle: Titanic Machine Learning from Disaster](https://www.kaggle.com/c/titanic/overview) -- [Extra](https://triangleinequality.wordpress.com/2013/09/08/basic-feature-engineering-with-the-titanic-data/)


```python
data = pd.read_csv('../data/kaggle-titanic-train.csv')
data.head(10)
```

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }
</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>PassengerId</th>
      <th>Survived</th>
      <th>Pclass</th>
      <th>Name</th>
      <th>Sex</th>
      <th>Age</th>
      <th>SibSp</th>
      <th>Parch</th>
      <th>Ticket</th>
      <th>Fare</th>
      <th>Cabin</th>
      <th>Embarked</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>1</td>
      <td>0</td>
      <td>3</td>
      <td>Braund, Mr. Owen Harris</td>
      <td>male</td>
      <td>22.0</td>
      <td>1</td>
      <td>0</td>
      <td>A/5 21171</td>
      <td>7.2500</td>
      <td>NaN</td>
      <td>S</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2</td>
      <td>1</td>
      <td>1</td>
      <td>Cumings, Mrs. John Bradley (Florence Briggs Th...</td>
      <td>female</td>
      <td>38.0</td>
      <td>1</td>
      <td>0</td>
      <td>PC 17599</td>
      <td>71.2833</td>
      <td>C85</td>
      <td>C</td>
    </tr>
    <tr>
      <th>2</th>
      <td>3</td>
      <td>1</td>
      <td>3</td>
      <td>Heikkinen, Miss. Laina</td>
      <td>female</td>
      <td>26.0</td>
      <td>0</td>
      <td>0</td>
      <td>STON/O2. 3101282</td>
      <td>7.9250</td>
      <td>NaN</td>
      <td>S</td>
    </tr>
    <tr>
      <th>3</th>
      <td>4</td>
      <td>1</td>
      <td>1</td>
      <td>Futrelle, Mrs. Jacques Heath (Lily May Peel)</td>
      <td>female</td>
      <td>35.0</td>
      <td>1</td>
      <td>0</td>
      <td>113803</td>
      <td>53.1000</td>
      <td>C123</td>
      <td>S</td>
    </tr>
    <tr>
      <th>4</th>
      <td>5</td>
      <td>0</td>
      <td>3</td>
      <td>Allen, Mr. William Henry</td>
      <td>male</td>
      <td>35.0</td>
      <td>0</td>
      <td>0</td>
      <td>373450</td>
      <td>8.0500</td>
      <td>NaN</td>
      <td>S</td>
    </tr>
    <tr>
      <th>5</th>
      <td>6</td>
      <td>0</td>
      <td>3</td>
      <td>Moran, Mr. James</td>
      <td>male</td>
      <td>NaN</td>
      <td>0</td>
      <td>0</td>
      <td>330877</td>
      <td>8.4583</td>
      <td>NaN</td>
      <td>Q</td>
    </tr>
    <tr>
      <th>6</th>
      <td>7</td>
      <td>0</td>
      <td>1</td>
      <td>McCarthy, Mr. Timothy J</td>
      <td>male</td>
      <td>54.0</td>
      <td>0</td>
      <td>0</td>
      <td>17463</td>
      <td>51.8625</td>
      <td>E46</td>
      <td>S</td>
    </tr>
    <tr>
      <th>7</th>
      <td>8</td>
      <td>0</td>
      <td>3</td>
      <td>Palsson, Master. Gosta Leonard</td>
      <td>male</td>
      <td>2.0</td>
      <td>3</td>
      <td>1</td>
      <td>349909</td>
      <td>21.0750</td>
      <td>NaN</td>
      <td>S</td>
    </tr>
    <tr>
      <th>8</th>
      <td>9</td>
      <td>1</td>
      <td>3</td>
      <td>Johnson, Mrs. Oscar W (Elisabeth Vilhelmina Berg)</td>
      <td>female</td>
      <td>27.0</td>
      <td>0</td>
      <td>2</td>
      <td>347742</td>
      <td>11.1333</td>
      <td>NaN</td>
      <td>S</td>
    </tr>
    <tr>
      <th>9</th>
      <td>10</td>
      <td>1</td>
      <td>2</td>
      <td>Nasser, Mrs. Nicholas (Adele Achem)</td>
      <td>female</td>
      <td>14.0</td>
      <td>1</td>
      <td>0</td>
      <td>237736</td>
      <td>30.0708</td>
      <td>NaN</td>
      <td>C</td>
    </tr>
  </tbody>
</table>
</div>




```python
data_filter_col = data[['Pclass', 'Sex', 'Age', 'SibSp', 'Parch', 'Fare', 'Survived']]
data_filter_col.head()
```

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }
</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>Pclass</th>
      <th>Sex</th>
      <th>Age</th>
      <th>SibSp</th>
      <th>Parch</th>
      <th>Fare</th>
      <th>Survived</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>3</td>
      <td>male</td>
      <td>22.0</td>
      <td>1</td>
      <td>0</td>
      <td>7.2500</td>
      <td>0</td>
    </tr>
    <tr>
      <th>1</th>
      <td>1</td>
      <td>female</td>
      <td>38.0</td>
      <td>1</td>
      <td>0</td>
      <td>71.2833</td>
      <td>1</td>
    </tr>
    <tr>
      <th>2</th>
      <td>3</td>
      <td>female</td>
      <td>26.0</td>
      <td>0</td>
      <td>0</td>
      <td>7.9250</td>
      <td>1</td>
    </tr>
    <tr>
      <th>3</th>
      <td>1</td>
      <td>female</td>
      <td>35.0</td>
      <td>1</td>
      <td>0</td>
      <td>53.1000</td>
      <td>1</td>
    </tr>
    <tr>
      <th>4</th>
      <td>3</td>
      <td>male</td>
      <td>35.0</td>
      <td>0</td>
      <td>0</td>
      <td>8.0500</td>
      <td>0</td>
    </tr>
  </tbody>
</table>
</div>




```python
data_filter_col['Sex'].replace(['female','male'],[1,0],inplace=True)
data_filter_col.isnull().sum()

    Pclass        0
    Sex           0
    Age         177
    SibSp         0
    Parch         0
    Fare          0
    Survived      0
    dtype: int64
```



```python
data_filter_col = data_filter_col.dropna()

data_filter_col.shape
(714, 7)
```

```python
X = data_filter_col[['Pclass', 'Sex', 'Age', 'SibSp', 'Parch', 'Fare']]
y = data_filter_col['Survived']

X.head(2)
```




<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }
</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>Pclass</th>
      <th>Sex</th>
      <th>Age</th>
      <th>SibSp</th>
      <th>Parch</th>
      <th>Fare</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>3</td>
      <td>0</td>
      <td>22.0</td>
      <td>1</td>
      <td>0</td>
      <td>7.2500</td>
    </tr>
    <tr>
      <th>1</th>
      <td>1</td>
      <td>1</td>
      <td>38.0</td>
      <td>1</td>
      <td>0</td>
      <td>71.2833</td>
    </tr>
  </tbody>
</table>
</div>




```python
corr = data_filter_col.corr()
corr.style.background_gradient(cmap='coolwarm')
```


<style  type="text/css" >
#T_6a223c04_b2a7_11eb_822f_01d1865ad078row0_col0,#T_6a223c04_b2a7_11eb_822f_01d1865ad078row1_col1,#T_6a223c04_b2a7_11eb_822f_01d1865ad078row2_col2,#T_6a223c04_b2a7_11eb_822f_01d1865ad078row3_col3,#T_6a223c04_b2a7_11eb_822f_01d1865ad078row4_col4,#T_6a223c04_b2a7_11eb_822f_01d1865ad078row5_col5,#T_6a223c04_b2a7_11eb_822f_01d1865ad078row6_col6{
            background-color:  #b40426;
            color:  #f1f1f1;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row0_col1,#T_6a223c04_b2a7_11eb_822f_01d1865ad078row0_col2,#T_6a223c04_b2a7_11eb_822f_01d1865ad078row0_col5,#T_6a223c04_b2a7_11eb_822f_01d1865ad078row0_col6,#T_6a223c04_b2a7_11eb_822f_01d1865ad078row2_col3,#T_6a223c04_b2a7_11eb_822f_01d1865ad078row2_col4,#T_6a223c04_b2a7_11eb_822f_01d1865ad078row5_col0{
            background-color:  #3b4cc0;
            color:  #f1f1f1;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row0_col3{
            background-color:  #9abbff;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row0_col4{
            background-color:  #7597f6;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row1_col0{
            background-color:  #8fb1fe;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row1_col2{
            background-color:  #7b9ff9;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row1_col3{
            background-color:  #a3c2fe;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row1_col4{
            background-color:  #b5cdfa;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row1_col5{
            background-color:  #d6dce4;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row1_col6{
            background-color:  #f7b99e;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row2_col0{
            background-color:  #5f7fe8;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row2_col1{
            background-color:  #4a63d3;
            color:  #f1f1f1;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row2_col5{
            background-color:  #c6d6f1;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row2_col6{
            background-color:  #7ea1fa;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row3_col0{
            background-color:  #c0d4f5;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row3_col1{
            background-color:  #84a7fc;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row3_col2{
            background-color:  #485fd1;
            color:  #f1f1f1;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row3_col4{
            background-color:  #d8dce2;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row3_col5{
            background-color:  #cedaeb;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row3_col6{
            background-color:  #8db0fe;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row4_col0{
            background-color:  #b7cff9;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row4_col1{
            background-color:  #afcafc;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row4_col2{
            background-color:  #6384eb;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row4_col3,#T_6a223c04_b2a7_11eb_822f_01d1865ad078row6_col5{
            background-color:  #e4d9d2;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row4_col5{
            background-color:  #dadce0;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row4_col6{
            background-color:  #aac7fd;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row5_col1{
            background-color:  #9dbdff;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row5_col2{
            background-color:  #abc8fd;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row5_col3{
            background-color:  #adc9fd;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row5_col4{
            background-color:  #a9c6fd;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row5_col6{
            background-color:  #d3dbe7;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row6_col0{
            background-color:  #6282ea;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row6_col1{
            background-color:  #f2cbb7;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row6_col2{
            background-color:  #80a3fa;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row6_col3{
            background-color:  #82a6fb;
            color:  #000000;
        }#T_6a223c04_b2a7_11eb_822f_01d1865ad078row6_col4{
            background-color:  #88abfd;
            color:  #000000;
        }
        </style>

<table id="T_6a223c04_b2a7_11eb_822f_01d1865ad078" ><thead>    <tr>        <th class="blank level0" ></th>        <th class="col_heading level0 col0" >Pclass</th>        <th class="col_heading level0 col1" >Sex</th>        <th class="col_heading level0 col2" >Age</th>        <th class="col_heading level0 col3" >SibSp</th>        <th class="col_heading level0 col4" >Parch</th>        <th class="col_heading level0 col5" >Fare</th>        <th class="col_heading level0 col6" >Survived</th>    </tr></thead><tbody>
                <tr>
                        <th id="T_6a223c04_b2a7_11eb_822f_01d1865ad078level0_row0" class="row_heading level0 row0" >Pclass</th>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row0_col0" class="data row0 col0" >1.000000</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row0_col1" class="data row0 col1" >-0.155460</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row0_col2" class="data row0 col2" >-0.369226</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row0_col3" class="data row0 col3" >0.067247</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row0_col4" class="data row0 col4" >0.025683</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row0_col5" class="data row0 col5" >-0.554182</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row0_col6" class="data row0 col6" >-0.359653</td>
            </tr>
            <tr>
                        <th id="T_6a223c04_b2a7_11eb_822f_01d1865ad078level0_row1" class="row_heading level0 row1" >Sex</th>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row1_col0" class="data row1 col0" >-0.155460</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row1_col1" class="data row1 col1" >1.000000</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row1_col2" class="data row1 col2" >-0.093254</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row1_col3" class="data row1 col3" >0.103950</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row1_col4" class="data row1 col4" >0.246972</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row1_col5" class="data row1 col5" >0.184994</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row1_col6" class="data row1 col6" >0.538826</td>
            </tr>
            <tr>
                        <th id="T_6a223c04_b2a7_11eb_822f_01d1865ad078level0_row2" class="row_heading level0 row2" >Age</th>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row2_col0" class="data row2 col0" >-0.369226</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row2_col1" class="data row2 col1" >-0.093254</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row2_col2" class="data row2 col2" >1.000000</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row2_col3" class="data row2 col3" >-0.308247</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row2_col4" class="data row2 col4" >-0.189119</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row2_col5" class="data row2 col5" >0.096067</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row2_col6" class="data row2 col6" >-0.077221</td>
            </tr>
            <tr>
                        <th id="T_6a223c04_b2a7_11eb_822f_01d1865ad078level0_row3" class="row_heading level0 row3" >SibSp</th>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row3_col0" class="data row3 col0" >0.067247</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row3_col1" class="data row3 col1" >0.103950</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row3_col2" class="data row3 col2" >-0.308247</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row3_col3" class="data row3 col3" >1.000000</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row3_col4" class="data row3 col4" >0.383820</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row3_col5" class="data row3 col5" >0.138329</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row3_col6" class="data row3 col6" >-0.017358</td>
            </tr>
            <tr>
                        <th id="T_6a223c04_b2a7_11eb_822f_01d1865ad078level0_row4" class="row_heading level0 row4" >Parch</th>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row4_col0" class="data row4 col0" >0.025683</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row4_col1" class="data row4 col1" >0.246972</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row4_col2" class="data row4 col2" >-0.189119</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row4_col3" class="data row4 col3" >0.383820</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row4_col4" class="data row4 col4" >1.000000</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row4_col5" class="data row4 col5" >0.205119</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row4_col6" class="data row4 col6" >0.093317</td>
            </tr>
            <tr>
                        <th id="T_6a223c04_b2a7_11eb_822f_01d1865ad078level0_row5" class="row_heading level0 row5" >Fare</th>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row5_col0" class="data row5 col0" >-0.554182</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row5_col1" class="data row5 col1" >0.184994</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row5_col2" class="data row5 col2" >0.096067</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row5_col3" class="data row5 col3" >0.138329</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row5_col4" class="data row5 col4" >0.205119</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row5_col5" class="data row5 col5" >1.000000</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row5_col6" class="data row5 col6" >0.268189</td>
            </tr>
            <tr>
                        <th id="T_6a223c04_b2a7_11eb_822f_01d1865ad078level0_row6" class="row_heading level0 row6" >Survived</th>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row6_col0" class="data row6 col0" >-0.359653</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row6_col1" class="data row6 col1" >0.538826</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row6_col2" class="data row6 col2" >-0.077221</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row6_col3" class="data row6 col3" >-0.017358</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row6_col4" class="data row6 col4" >0.093317</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row6_col5" class="data row6 col5" >0.268189</td>
                        <td id="T_6a223c04_b2a7_11eb_822f_01d1865ad078row6_col6" class="data row6 col6" >1.000000</td>
            </tr>
    </tbody></table>




```python
X.describe()
```




<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }
</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>Pclass</th>
      <th>Sex</th>
      <th>Age</th>
      <th>SibSp</th>
      <th>Parch</th>
      <th>Fare</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>count</th>
      <td>714.000000</td>
      <td>714.000000</td>
      <td>714.000000</td>
      <td>714.000000</td>
      <td>714.000000</td>
      <td>714.000000</td>
    </tr>
    <tr>
      <th>mean</th>
      <td>2.236695</td>
      <td>0.365546</td>
      <td>29.699118</td>
      <td>0.512605</td>
      <td>0.431373</td>
      <td>34.694514</td>
    </tr>
    <tr>
      <th>std</th>
      <td>0.838250</td>
      <td>0.481921</td>
      <td>14.526497</td>
      <td>0.929783</td>
      <td>0.853289</td>
      <td>52.918930</td>
    </tr>
    <tr>
      <th>min</th>
      <td>1.000000</td>
      <td>0.000000</td>
      <td>0.420000</td>
      <td>0.000000</td>
      <td>0.000000</td>
      <td>0.000000</td>
    </tr>
    <tr>
      <th>25%</th>
      <td>1.000000</td>
      <td>0.000000</td>
      <td>20.125000</td>
      <td>0.000000</td>
      <td>0.000000</td>
      <td>8.050000</td>
    </tr>
    <tr>
      <th>50%</th>
      <td>2.000000</td>
      <td>0.000000</td>
      <td>28.000000</td>
      <td>0.000000</td>
      <td>0.000000</td>
      <td>15.741700</td>
    </tr>
    <tr>
      <th>75%</th>
      <td>3.000000</td>
      <td>1.000000</td>
      <td>38.000000</td>
      <td>1.000000</td>
      <td>1.000000</td>
      <td>33.375000</td>
    </tr>
    <tr>
      <th>max</th>
      <td>3.000000</td>
      <td>1.000000</td>
      <td>80.000000</td>
      <td>5.000000</td>
      <td>6.000000</td>
      <td>512.329200</td>
    </tr>
  </tbody>
</table>
</div>




```python
X_train, X_val, y_train, y_val = train_test_split(
                    X, y, test_size=0.30, random_state=2021)
```


```python
tree = DecisionTreeClassifier()

tree.fit(X_train, y_train)

predicted_val = tree.predict(X_val)
predicted_train = tree.predict(X_train)

acc_train = accuracy_score(y_train, predicted_train)
acc_val = accuracy_score(y_val, predicted_val)
print(f"Accuracy: Train {acc_train:0.3f} | Val {acc_val:0.3f}")

report = classification_report(y_val, predicted_val)
print(report)

    Accuracy: Train 0.990 | Val 0.744

                  precision    recall  f1-score   support

               0       0.78      0.79      0.78       126
               1       0.69      0.69      0.69        89

        accuracy                           0.74       215
       macro avg       0.74      0.74      0.74       215
    weighted avg       0.74      0.74      0.74       215
```



```python
knn = KNeighborsClassifier(n_neighbors=5)

knn.fit(X_train, y_train)

predicted_val = knn.predict(X_val)
predicted_train = knn.predict(X_train)

acc_train = accuracy_score(y_train, predicted_train)
acc_val = accuracy_score(y_val, predicted_val)
print(f"Accuracy: Train {acc_train:0.3f} | Val {acc_val:0.3f}")

report = classification_report(y_val, predicted_val)
print(report)

    Accuracy: Train 0.796 | Val 0.656
                  precision    recall  f1-score   support

               0       0.69      0.75      0.72       126
               1       0.59      0.53      0.56        89

        accuracy                           0.66       215
       macro avg       0.64      0.64      0.64       215
    weighted avg       0.65      0.66      0.65       215
```



```python
norm = Normalizer()
X_train = norm.fit_transform(X_train)
X_val   = norm.transform(X_val)

knn = KNeighborsClassifier(n_neighbors=5)
knn.fit(X_train, y_train)

predicted_val = knn.predict(X_val)
predicted_train = knn.predict(X_train)

acc_train = accuracy_score(y_train, predicted_train)
acc_val = accuracy_score(y_val, predicted_val)
print(f"Accuracy: Train {acc_train:0.3f} | Val {acc_val:0.3f}")

report = classification_report(y_val, predicted_val)
print(report)

    Accuracy: Train 0.820 | Val 0.721
                  precision    recall  f1-score   support

               0       0.74      0.82      0.77       126
               1       0.69      0.58      0.63        89

        accuracy                           0.72       215
       macro avg       0.71      0.70      0.70       215
    weighted avg       0.72      0.72      0.72       215
```
