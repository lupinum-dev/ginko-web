Source
  Folder1
      Folder2
          _meta.md //(path="Folder1/Folder2/")
        Note2.md
    _meta.md //(path="Folder1/")
    Note1.md
  FolderX
    NoteX.md
    
Target
  hash("Folder1/") //when a _meta inside folder we put the path in hash function -> new path)
    hash("Folder1/Folder2/")
      _meta.md
      Note2.md
    _meta.md
    Note1.md
  FolderX
    NoteX.md
  

  -----

  .
├── Source/
│   ├── Folder1/
│   │   ├── Folder2/
│   │   │   ├── _meta.md //(path="Folder1/Folder2/")
│   │   │   └── Note2.md
│   │   ├── _meta.md //(path="Folder1/")
│   │   └── Note1.md
│   └── FolderX/
│       └── NoteX.md
└── Target/
    ├── hash("Folder1/") //when a _meta inside folder we put the path in hash function -> new path)/
    │   ├── hash("Folder1/Folder2/")/
    │   │   ├── _meta.md
    │   │   └── Note2.md
    │   ├── _meta.md
    │   └── Note1.md
    └── FolderX/
        └── NoteX.md


XXXXXXXXX

Source
  Folder1 
      Folder2
          _meta.md //(path="Folder1/Folder2/")
        Note2.md
    _meta.md // ❌ when we remove this meta!
    Note1.md
  FolderX
    NoteX.md
    
Target
  Folder1 🚧 //when a meta is removed in the tree, we need to rebuild the tree part, there we need to delete the old files and write new.. in a reliable way...
    hash("Folder1/Folder2/") 🚧
      _meta.md 🚧
      Note2.md 🚧
    Note1.md 🚧
  FolderX
    NoteX.md
  
  

    .
├── Source/
│   ├── Folder1 /
│   │   ├── Folder2/
│   │   │   ├── _meta.md //(path="Folder1/Folder2/")
│   │   │   └── Note2.md
│   │   ├── _meta.md // ❌ when we remove this meta!
│   │   └── Note1.md
│   └── FolderX/
│       └── NoteX.md
└── Target/
    ├── Folder1 🚧 //when a meta is removed in the tree, we need to rebuild the tree part, there we need to delete the old files and write new.. in a reliable way.../
    │   ├── hash("Folder1/Folder2/") 🚧/
    │   │   ├── _meta.md 🚧
    │   │   └── Note2.md 🚧
    │   └── Note1.md 🚧
    └── FolderX/
        └── NoteX.md