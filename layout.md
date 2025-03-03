## Basic Syntax

To create a layout, use the `::layout` container with each column defined by `--col`:

```markdown
::layout
--col
Your content goes here
::
```

## Column Configurations

### Single Column

A single column layout centers content on the page, making it ideal for focused reading:

```markdown
::layout
--col
Use one Column to center the text
::
```

**This renders as:**

::ginko-center
Use one Column to center the text
::

### Two Columns

Split content into two equal columns to display related information side by side:

```markdown
::layout
--col
Use two columns 
--col
Use two columns 
::
```

**This renders as:**

::ginko-layout
::ginko-column
Use two columns 
::
::ginko-column
Use two columns 
::
::

### Three Columns

Create three equal columns to present multiple items in a compact format:

```markdown
::layout
--col
First
--col
Second
--col
Third
::
```

**This renders as:**

::ginko-layout
::ginko-column
First
::
::ginko-column
Second
::
::ginko-column
Third
::
::

## Custom Column Sizes

You can adjust column sizes using the `size` parameter:

- `sm` - Small column
- `md` - Medium column (default)
- `lg` - Large column

```markdown
::layout(type="border")
--col(size="lg")
Image
--col
You can write here for your image description
::
```

**This renders as:**

::ginko-layout{type="border"}
::ginko-column{size="lg"}
Image
::
::ginko-column
You can write here for your image description
::
::


---------

Implement LayoutModifier,with test and everthing needed:

SPEC:

## Basic Syntax

To create a layout, use the `::layout` container with each column defined by `--col`:

```markdown
::layout
--col
Your content goes here
::
```

## Column Configurations

### Single Column

A single column layout centers content on the page, making it ideal for focused reading:

```markdown
::layout
--col
Use one Column to center the text
::
```

**This renders as:**

::ginko-center
Use one Column to center the text
::

### Two Columns

Split content into two equal columns to display related information side by side:

```markdown
::layout
--col
Use two columns 
--col
Use two columns 
::
```

**This renders as:**

::ginko-layout
::ginko-column
Use two columns 
::
::ginko-column
Use two columns 
::
::

### Three Columns

Create three equal columns to present multiple items in a compact format:

```markdown
::layout
--col
First
--col
Second
--col
Third
::
```

**This renders as:**

::ginko-layout
::ginko-column
First
::
::ginko-column
Second
::
::ginko-column
Third
::
::

## Custom Column Sizes

You can adjust column sizes using the `size` parameter:

- `sm` - Small column
- `md` - Medium column (default)
- `lg` - Large column

```markdown
::layout(type="border")
--col(size="lg")
Image
--col
You can write here for your image description
::
```

**This renders as:**

::ginko-layout{type="border"}
::ginko-column{size="lg"}
Image
::
::ginko-column
You can write here for your image description
::
::




INPUT:
::layout
--col
Center
::

::layout
--col
First
--col
Second
::

::layout(type="border")
--col
First
--col
Second
::

AST:

ast {
  "type": "document",
  "content": [
    {
      "type": "block",
      "name": "layout",
      "properties": [],
      "content": [
        {
          "type": "dash-element",
          "name": "col",
          "properties": [],
          "content": [],
          "label": "Center"
        }
      ]
    },
    {
      "type": "block",
      "name": "layout",
      "properties": [],
      "content": [
        {
          "type": "dash-element",
          "name": "col",
          "properties": [],
          "content": [],
          "label": "First"
        },
        {
          "type": "dash-element",
          "name": "col",
          "properties": [],
          "content": [],
          "label": "Second"
        }
      ]
    },
    {
      "type": "block",
      "name": "layout",
      "properties": [
        {
          "name": "type",
          "value": "border"
        }
      ],
      "content": [
        {
          "type": "dash-element",
          "name": "col",
          "properties": [],
          "content": [],
          "label": "First"
        },
        {
          "type": "dash-element",
          "name": "col",
          "properties": [],
          "content": [],
          "label": "Second"
        }
      ]
    }
  ]
}

--------




Make sure we render like this:

INPUT:

::layout
--col
Center
::

SHOULD BE :

::ginko-center
Center
::

---
INPUT:
::layout
--col
First
--col
Second
::

SHOULD BE :

::ginko-layout
::ginko-column
First
::
::ginko-column
Second
::
::

---
INPUT:
::layout(type="border")
--col
First
--col
Second
::
SHOULD BE:

::ginko-layout{type="border"}
::ginko-column
First
::
::ginko-column
Second
::
::


-------------
