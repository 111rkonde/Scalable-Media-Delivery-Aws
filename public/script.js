class MediaGallery {
    constructor() {
        this.files = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.currentFilter = 'all';
        this.currentSearch = '';
        this.currentPreviewFile = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadFiles();
    }

    bindEvents() {
        // Upload button
        document.getElementById('uploadBtn').addEventListener('click', () => {
            this.showUploadModal();
        });

        // Upload modal
        document.getElementById('closeUploadModal').addEventListener('click', () => {
            this.hideUploadModal();
        });

        document.getElementById('browseBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });

        // Drag and drop
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFileSelect(e.dataTransfer.files);
        });

        // Search and filter
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.currentSearch = e.target.value;
            this.debounceSearch();
        });

        document.getElementById('typeFilter').addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.currentPage = 1;
            this.loadFiles();
        });

        // Retry button
        document.getElementById('retryBtn').addEventListener('click', () => {
            this.loadFiles();
        });

        // Pagination
        document.getElementById('prevBtn').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadFiles();
            }
        });

        document.getElementById('nextBtn').addEventListener('click', () => {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.loadFiles();
            }
        });

        // Preview modal
        document.getElementById('closePreviewModal').addEventListener('click', () => {
            this.hidePreviewModal();
        });

        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.downloadFile();
        });

        document.getElementById('deleteBtn').addEventListener('click', () => {
            this.deleteFile();
        });

        // Close modals on outside click
        document.getElementById('uploadModal').addEventListener('click', (e) => {
            if (e.target.id === 'uploadModal') {
                this.hideUploadModal();
            }
        });

        document.getElementById('previewModal').addEventListener('click', (e) => {
            if (e.target.id === 'previewModal') {
                this.hidePreviewModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideUploadModal();
                this.hidePreviewModal();
            }
        });
    }

    debounceSearch() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.currentPage = 1;
            this.loadFiles();
        }, 300);
    }

    async loadFiles() {
        try {
            this.showLoading();
            
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: 20,
                type: this.currentFilter,
                search: this.currentSearch
            });

            const response = await fetch(`/api/files?${params}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch files');
            }

            const data = await response.json();
            
            this.files = data.files;
            this.totalPages = data.pagination.totalPages;
            
            this.renderGallery();
            this.updatePagination(data.pagination);
            this.updateStats(data.files);
            this.hideLoading();
            
            // Load URLs lazily after gallery is rendered
            this.lazyLoadUrls();
            
        } catch (error) {
            console.error('Error loading files:', error);
            this.showError('Failed to load files. Please try again.');
            this.hideLoading();
        }
    }

    async lazyLoadUrls() {
        // Load URLs for visible items first
        const galleryItems = document.querySelectorAll('.gallery-item');
        const visibleItems = Array.from(galleryItems).slice(0, 12); // Load first 12 items
        
        for (let i = 0; i < visibleItems.length; i++) {
            const item = visibleItems[i];
            const fileKey = item.dataset.key;
            const file = this.files.find(f => f.key === fileKey);
            
            if (file && !file.url) {
                try {
                    const response = await fetch(`/api/files/${encodeURIComponent(fileKey)}/url`);
                    const data = await response.json();
                    file.url = data.url;
                    
                    // Update the media element with the URL
                    this.updateMediaElement(item, file);
                } catch (error) {
                    console.error('Error loading URL:', error);
                }
            }
        }
    }

    updateMediaElement(item, file) {
        const mediaElement = item.querySelector('img, video');
        if (mediaElement) {
            mediaElement.src = file.url;
        }
    }

    renderGallery() {
        const galleryGrid = document.getElementById('galleryGrid');
        
        if (this.files.length === 0) {
            galleryGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <i class="fas fa-folder-open" style="font-size: 3rem; color: #667eea; margin-bottom: 1rem;"></i>
                    <h3>No files found</h3>
                    <p>Upload some files to get started!</p>
                </div>
            `;
            return;
        }

        galleryGrid.innerHTML = this.files.map(file => this.createGalleryItem(file)).join('');
        
        // Add click events to gallery items
        galleryGrid.querySelectorAll('.gallery-item').forEach((item, index) => {
            item.addEventListener('click', () => {
                this.showPreview(this.files[index]);
            });
        });
    }

    createGalleryItem(file) {
        const fileName = file.key.split('/').pop();
        const fileSize = this.formatFileSize(file.size);
        
        let mediaContent = '';
        
        switch (file.type) {
            case 'image':
                mediaContent = `<img src="" alt="${fileName}" class="gallery-item-image" loading="lazy">`;
                break;
            case 'video':
                mediaContent = `
                    <div class="video-wrapper">
                        <video src="" class="gallery-item-video" loading="lazy"></video>
                        <div class="video-play-button">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>
                `;
                break;
            case 'audio':
                mediaContent = `
                    <div class="gallery-item-audio">
                        <i class="fas fa-music"></i>
                    </div>
                `;
                break;
            default:
                mediaContent = `
                    <div class="gallery-item-audio">
                        <i class="fas fa-file"></i>
                    </div>
                `;
        }

        return `
            <div class="gallery-item" data-key="${file.key}">
                ${mediaContent}
                <div class="gallery-item-info">
                    <div class="gallery-item-name" title="${fileName}">${fileName}</div>
                    <div class="gallery-item-meta">
                        <span class="file-type-badge">${file.type}</span>
                        <span>${fileSize}</span>
                    </div>
                </div>
            </div>
        `;
    }

    updatePagination(pagination) {
        const paginationSection = document.getElementById('pagination');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const pageInfo = document.getElementById('pageInfo');

        if (pagination.totalPages <= 1) {
            paginationSection.style.display = 'none';
            return;
        }

        paginationSection.style.display = 'flex';
        prevBtn.disabled = !pagination.hasPrev;
        nextBtn.disabled = !pagination.hasNext;
        pageInfo.textContent = `Page ${pagination.currentPage} of ${pagination.totalPages}`;
    }

    updateStats(files) {
        const totalFiles = files.length;
        const imageCount = files.filter(f => f.type === 'image').length;
        const videoCount = files.filter(f => f.type === 'video').length;
        const audioCount = files.filter(f => f.type === 'audio').length;

        document.getElementById('totalFiles').textContent = totalFiles;
        document.getElementById('imageCount').textContent = imageCount;
        document.getElementById('videoCount').textContent = videoCount;
        document.getElementById('audioCount').textContent = audioCount;
    }

    showPreview(file) {
        this.currentPreviewFile = file;
        const modal = document.getElementById('previewModal');
        const title = document.getElementById('previewTitle');
        const container = document.getElementById('previewContainer');
        
        title.textContent = file.key.split('/').pop();
        
        let previewContent = '';
        
        switch (file.type) {
            case 'image':
                previewContent = `<img src="${file.url}" alt="${file.key}">`;
                break;
            case 'video':
                previewContent = `<video src="${file.url}" controls autoplay></video>`;
                break;
            case 'audio':
                previewContent = `
                    <div style="padding: 2rem;">
                        <i class="fas fa-music" style="font-size: 4rem; color: #667eea; margin-bottom: 1rem;"></i>
                        <h3>${file.key.split('/').pop()}</h3>
                        <audio src="${file.url}" controls autoplay style="width: 100%; margin-top: 1rem;"></audio>
                    </div>
                `;
                break;
            default:
                previewContent = `
                    <div style="padding: 2rem;">
                        <i class="fas fa-file" style="font-size: 4rem; color: #667eea; margin-bottom: 1rem;"></i>
                        <h3>${file.key.split('/').pop()}</h3>
                        <p>File size: ${this.formatFileSize(file.size)}</p>
                    </div>
                `;
        }
        
        container.innerHTML = previewContent;
        modal.classList.add('active');
    }

    hidePreviewModal() {
        document.getElementById('previewModal').classList.remove('active');
        this.currentPreviewFile = null;
    }

    showUploadModal() {
        document.getElementById('uploadModal').classList.add('active');
    }

    hideUploadModal() {
        document.getElementById('uploadModal').classList.remove('active');
        document.getElementById('fileInput').value = '';
        document.getElementById('uploadList').innerHTML = '';
        document.getElementById('uploadProgress').style.display = 'none';
    }

    async handleFileSelect(files) {
        if (files.length === 0) return;

        // Validate file sizes (5GB limit)
        const maxSize = 5 * 1024 * 1024 * 1024; // 5GB
        const validFiles = [];
        
        for (const file of files) {
            if (file.size > maxSize) {
                this.showToast(`${file.name} exceeds 5GB limit`, 'error');
                continue;
            }
            validFiles.push(file);
        }

        if (validFiles.length === 0) {
            return;
        }

        const uploadList = document.getElementById('uploadList');
        const progressContainer = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        progressContainer.style.display = 'block';
        uploadList.innerHTML = '';

        for (let i = 0; i < validFiles.length; i++) {
            const file = validFiles[i];
            const uploadItem = this.createUploadItem(file);
            uploadList.appendChild(uploadItem);

            try {
                progressText.textContent = `Uploading ${file.name}...`;
                progressFill.style.width = `${((i + 1) / validFiles.length) * 100}%`;

                await this.uploadFile(file, uploadItem);
                
            } catch (error) {
                console.error('Upload error:', error);
                this.updateUploadItem(uploadItem, file.name, 'error', error.message);
            }
        }

        setTimeout(() => {
            this.hideUploadModal();
            this.loadFiles();
            this.showToast('Files uploaded successfully!', 'success');
        }, 1000);
    }

    createUploadItem(file) {
        const item = document.createElement('div');
        item.className = 'upload-item';
        item.innerHTML = `
            <span class="upload-item-name">${file.name}</span>
            <span class="upload-item-status">Uploading...</span>
        `;
        return item;
    }

    updateUploadItem(item, fileName, status, message = '') {
        const statusElement = item.querySelector('.upload-item-status');
        statusElement.className = `upload-item-status ${status}`;
        statusElement.textContent = status === 'success' ? '✓ Uploaded' : `✗ ${message}`;
    }

    async uploadFile(file, uploadItem) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Upload failed');
        }

        const result = await response.json();
        this.updateUploadItem(uploadItem, file.name, 'success');
        return result;
    }

    async downloadFile() {
        if (!this.currentPreviewFile) return;

        const a = document.createElement('a');
        a.href = this.currentPreviewFile.url;
        a.download = this.currentPreviewFile.key.split('/').pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        this.showToast('Download started!', 'success');
    }

    async deleteFile() {
        if (!this.currentPreviewFile) return;

        if (!confirm('Are you sure you want to delete this file?')) {
            return;
        }

        try {
            const response = await fetch(`/api/files/${encodeURIComponent(this.currentPreviewFile.key)}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Delete failed');
            }

            this.hidePreviewModal();
            this.loadFiles();
            this.showToast('File deleted successfully!', 'success');

        } catch (error) {
            console.error('Delete error:', error);
            this.showToast('Failed to delete file', 'error');
        }
    }

    showLoading() {
        document.getElementById('loadingState').style.display = 'block';
        document.getElementById('gallery').style.display = 'none';
        document.getElementById('errorState').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('gallery').style.display = 'block';
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorState').style.display = 'block';
        document.getElementById('gallery').style.display = 'none';
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        const toastIcon = document.getElementById('toastIcon');

        toastMessage.textContent = message;
        toast.className = `toast ${type}`;
        
        if (type === 'success') {
            toastIcon.className = 'fas fa-check-circle toast-icon';
        } else {
            toastIcon.className = 'fas fa-exclamation-circle toast-icon';
        }

        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize the gallery when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MediaGallery();
});
