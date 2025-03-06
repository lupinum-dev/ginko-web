<template>
  <div class="file-list-container">
    <h2>Vault Files</h2>
    <div class="search-container">
      <input 
        type="text" 
        v-model="searchTerm" 
        placeholder="Search files..." 
        class="search-input"
      />
    </div>
    <div class="file-stats">
      Total: {{ files.length }} items
    </div>
    <ul class="file-list">
      <li v-for="file in filteredFiles" :key="file.path" class="file-item">
        <div class="file-icon" :class="getFileIconClass(file)"></div>
        <div class="file-details">
          <div class="file-name">{{ file.name }}</div>
          <div class="file-path">{{ file.path }}</div>
          <div class="file-meta" v-if="!file.isFolder">
            <span class="file-size">{{ file.size }}</span>
            <span class="file-date">{{ file.mtime }}</span>
          </div>
        </div>
      </li>
    </ul>
    <div v-if="filteredFiles.length === 0" class="no-files">
      No files found matching your search.
    </div>
  </div>
</template>

<script>
export default {
  name: 'FileList',
  props: {
    files: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      searchTerm: ''
    }
  },
  computed: {
    filteredFiles() {
      if (!this.searchTerm) {
        return this.files;
      }
      
      const term = this.searchTerm.toLowerCase();
      return this.files.filter(file => 
        file.name.toLowerCase().includes(term) || 
        file.path.toLowerCase().includes(term)
      );
    }
  },
  methods: {
    getFileIconClass(file) {
      // Simple logic to determine icon class based on file type
      if (file.isFolder) {
        return 'folder-icon';
      }
      
      const extension = file.extension?.toLowerCase();
      if (extension === 'md') {
        return 'markdown-icon';
      } else if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(extension)) {
        return 'image-icon';
      } else if (['pdf'].includes(extension)) {
        return 'pdf-icon';
      } else if (['js', 'ts', 'jsx', 'tsx'].includes(extension)) {
        return 'code-icon';
      } else if (['json', 'yml', 'yaml', 'toml'].includes(extension)) {
        return 'config-icon';
      }
      
      return 'file-icon';
    }
  }
}
</script>

<style scoped>
.file-list-container {
  font-family: var(--font-interface);
  padding: 16px;
  max-height: 100%;
  overflow: auto;
}

h2 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 1.5em;
  font-weight: 600;
}

.search-container {
  margin-bottom: 16px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid var(--background-modifier-border);
  background-color: var(--background-primary);
  color: var(--text-normal);
}

.file-stats {
  margin-bottom: 12px;
  font-size: 0.9em;
  color: var(--text-muted);
}

.file-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.file-item {
  display: flex;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid var(--background-modifier-border);
}

.file-icon {
  width: 20px;
  height: 20px;
  margin-right: 12px;
  margin-top: 2px;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
}

.folder-icon::before {
  content: "📁";
}

.file-icon::before {
  content: "📄";
}

.markdown-icon::before {
  content: "📝";
}

.image-icon::before {
  content: "🖼️";
}

.pdf-icon::before {
  content: "📑";
}

.code-icon::before {
  content: "💻";
}

.config-icon::before {
  content: "⚙️";
}

.file-details {
  flex: 1;
}

.file-name {
  font-weight: 500;
  color: var(--text-normal);
}

.file-path {
  font-size: 0.85em;
  color: var(--text-muted);
  margin-top: 2px;
}

.file-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.8em;
  color: var(--text-faint);
  margin-top: 4px;
}

.no-files {
  padding: 16px 0;
  text-align: center;
  color: var(--text-muted);
}
</style> 