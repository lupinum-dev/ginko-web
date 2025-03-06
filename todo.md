Current situaiton is that we have now nodes, which are connected by folders, thats fine, but we we need is to connect the embedded assets of a markdown file, which is not _meta. 

---
We have an old version "src/services/dependencyManager.ts" where we did such an implementation, lets create it.

---
Dont show the folders in the nodes!!

I want to have it like this:

{
  "options": {
    "type": "mixed",
    "multi": false,
    "allowSelfLoops": false
  },
  "attributes": {},
  "nodes": [
    {
      "key": "Folder1/Note1.md",
      "attributes": {
        "type": "NoteFile",
        "label": "Note1.md"
      }
    },
    {
      "key": "Folder1/_meta.md",
      "attributes": {
        "type": "MetaFile",
        "label": "_meta.md"
      }
    },
    {
      "key": "Folder2/Note2.md",
      "attributes": {
        "type": "NoteFile",
        "label": "Note2.md"
      }
    },
    {
      "key": "Folder1/_assets/img2.png",
      "attributes": {
        "type": "AssetFile",
        "label": "img2.png"
      }
    },
    {
      "key": "Folder1/_assets/img1.png",
      "attributes": {
        "type": "AssetFile",
        "label": "img1.png"
      }
    },
    {
      "key": "Folder1/Folder1-1/Note1-1.md",
      "attributes": {
        "type": "NoteFile",
        "label": "Note1-1.md"
      }
    },
    {
      "key": "Folder2/Folder2-1/_meta.md",
      "attributes": {
        "type": "MetaFile",
        "label": "_meta.md"
      }
    },
    {
      "key": "Folder2/Folder2-1/Note2-1.md",
      "attributes": {
        "type": "NoteFile",
        "label": "Note2-1.md"
      }
    },
    {
      "key": "Folder2/Folder2-1/_assets/img1x.png",
      "attributes": {
        "type": "AssetFile",
        "label": "img1x.png"
      }
    },
    {
      "key": "Folder2/Folder2-1/_assets/img2x.png",
      "attributes": {
        "type": "AssetFile",
        "label": "img2x.png"
      }
    }
  ],
  "edges": [
    {
      "key": "geid_63_0",
      "source": "Folder2/Note2.md",
      "target": "Folder2/Folder2-1/_assets/img1x.png",
      "attributes": {
        "type": "depends_on"
      }
    },
    {
      "key": "geid_63_1",
      "source": "Folder2/Note2.md",
      "target": "Folder2/Folder2-1/_assets/img2x.png",
      "attributes": {
        "type": "depends_on"
      }
    },
    {
      "key": "geid_63_2",
      "source": "Folder1/Folder1-1/Note1-1.md",
      "target": "Folder1/_assets/img1.png",
      "attributes": {
        "type": "depends_on"
      }
    },
    {
      "key": "geid_63_3",
      "source": "Folder1/Folder1-1/Note1-1.md",
      "target": "Folder1/_assets/img2.png",
      "attributes": {
        "type": "depends_on"
      }
    },
    {
      "key": "geid_63_4",
      "source": "Folder1/Folder1-1/Note1-1.md",
      "target": "Folder2/Folder2-1/_assets/img1x.png",
      "attributes": {
        "type": "depends_on"
      }
    },
    {
      "key": "geid_63_5",
      "source": "Folder2/Folder2-1/Note2-1.md",
      "target": "Folder2/Folder2-1/_assets/img1x.png",
      "attributes": {
        "type": "depends_on"
      }
    }
  ]
}

---
Also use our models /src/models/**