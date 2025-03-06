<template>
  <div class="file-list-view">
    <FileList :files="files" />
  </div>
</template>

<script>
import FileList from './FileList.vue';

export default {
  name: 'FileListView',
  components: {
    FileList
  },
  props: {
    app: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      files: []
    }
  },
  mounted() {
    this.loadFiles();
  },
  methods: {
    loadFiles() {
      // Get all loaded files from Obsidian vault
      const allFiles = this.app.vault.getAllLoadedFiles();
      
      // Transform files to a format suitable for our component
      this.files = allFiles.map(file => {
        return {
          name: file.name,
          path: file.path,
          extension: file.extension || '',
          children: file.children || null,
          isFolder: Boolean(file.children),
          // Add additional properties that might be useful
          size: file.stat ? this.formatFileSize(file.stat.size) : '',
          mtime: file.stat ? new Date(file.stat.mtime).toLocaleString() : '',
        };
      });
      
      // Sort files: folders first, then alphabetically
      this.files.sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name);
      });
    },
    
    formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      if (!bytes) return '';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
  }
}
</script>

<style scoped>
.file-list-view {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style> 