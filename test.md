Change our component parser so that we also process childs:
{
component: 'file-tree'
props: {
title: 'This is the title'
icon: 'lucide:folder-tree'
auto-slash: 'false'
show-arrow: 'true' // handle when showArrow is in Pascal Case we change to kebab case
children: []
}

We have this where we dont have children:



but for a steps we have children:

::steps(color="green") XY Test
--step(icon="test" ) Title of Step 1
...
--step(icon="test" ) Title of Step 2
...
::


{
component: 'steps'
props: {
color: 'green'
main: 'XY Test'
children: [
  {
    position: 1
    type: step
    main: Title of Step 1
    props: {
      icon: 'test'
    }
  },
    {
    position: 2
    type: step
    main: Title of Step 2
    props: {
      icon: 'test'
    }
  }
]
}

---

Make it so it works with

::tabs
Content of Tabs...as
--tab Tab 1
This is the contnet of Tab 1

asda
da
sd
asd
as
das
d
asd
as
--tab Tab 2
This is the content of Tab 2a
asda
asdas
d
3j42h3 4he jhj312h4kj32h4k234h1kj2he kqwdasdad
This is the content of Tab 2a
asda
asdas
d
3j42h3 4he jhj312h4kj32h4k234h1kj2he kqwdasdad
::

And similar structured components like this

::layout
--col Column 1

... content

--col Column 2

... content

::

---
Make a universal solution what parses this syntax and give back the info..
If you find a better strucutee for the info, please implement (nameing, etc...)