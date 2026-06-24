'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, FolderUp, FileUp, CheckCircle, AlertCircle } from 'lucide-react';

interface FileUploaderProps {
  projectId: string;
  currentPath: string; // current directory path in the repo
  accessToken: string;
  userName: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void; // refresh file tree after upload
}

interface UploadFile {
  file: File;
  relativePath: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export default function FileUploader({
  projectId,
  currentPath,
  accessToken,
  userName,
  userId,
  isOpen,
  onClose,
  onUploadComplete,
}: FileUploaderProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((fileList: FileList | File[], relativePaths?: string[]) => {
    const newFiles: UploadFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i] as File;
      // Skip hidden files and system files
      if (file.name.startsWith('.') || file.name === 'Thumbs.db' || file.name === 'desktop.ini') {
        continue;
      }
      const relativePath = relativePaths
        ? relativePaths[i]
        : (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;

      newFiles.push({
        file,
        relativePath,
        status: 'pending',
      });
    }
    setFiles(prev => [...prev, ...newFiles]);
    setUploadResult(null);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (!items) return;

    const fileEntries: { file: File; path: string }[] = [];

    // Process dropped items (may include folders)
    const processEntry = async (entry: FileSystemEntry, path: string): Promise<void> => {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve) => {
          (entry as FileSystemFileEntry).file(resolve);
        });
        fileEntries.push({ file, path: path + entry.name });
      } else if (entry.isDirectory) {
        const dirReader = (entry as FileSystemDirectoryEntry).createReader();
        const entries = await new Promise<FileSystemEntry[]>((resolve) => {
          dirReader.readEntries(resolve);
        });
        for (const childEntry of entries) {
          await processEntry(childEntry, path + entry.name + '/');
        }
      }
    };

    const promises: Promise<void>[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (entry) {
        promises.push(processEntry(entry, ''));
      }
    }
    await Promise.all(promises);

    if (fileEntries.length > 0) {
      const droppedFiles = fileEntries.map(e => e.file);
      const paths = fileEntries.map(e => e.path);
      addFiles(droppedFiles, paths);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadResult(null);
    setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const })));

    try {
      const formData = new FormData();
      formData.append('projectId', projectId);
      formData.append('path', currentPath);
      formData.append('accessToken', accessToken);
      formData.append('userName', userName);
      formData.append('userId', userId);

      for (const uploadFile of files) {
        // Create a new File with the relative path encoded in the name
        const fileWithPath = new File([uploadFile.file], uploadFile.relativePath, {
          type: uploadFile.file.type,
        });
        formData.append('files', fileWithPath);
      }

      const res = await fetch('/api/gitlab/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setFiles(prev => prev.map(f => ({ ...f, status: 'success' as const })));
        setUploadResult({
          success: true,
          message: `成功上传 ${data.files.length} 个文件`,
        });
        // Refresh file tree after short delay
        setTimeout(() => {
          onUploadComplete();
        }, 1000);
      } else {
        setFiles(prev => prev.map(f => ({ ...f, status: 'error' as const, error: data.error })));
        setUploadResult({
          success: false,
          message: data.error || '上传失败',
        });
      }
    } catch (err) {
      console.error('Upload error:', err);
      setFiles(prev => prev.map(f => ({ ...f, status: 'error' as const, error: '网络错误' })));
      setUploadResult({
        success: false,
        message: '网络错误，请重试',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFiles([]);
      setUploadResult(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">上传文件</h2>
          </div>
          <button onClick={handleClose} disabled={uploading} className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-50">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {/* Target path info */}
          <div className="mb-3 text-sm text-gray-500">
            上传到：<span className="font-mono text-gray-700">{currentPath || '根目录'}</span>
            <span className="ml-2 text-xs text-gray-400">（提交者：{userName}）</span>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="text-sm text-gray-600 mb-3">
              拖拽文件或文件夹到这里
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <FileUp className="w-4 h-4" />
                选择文件
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <FolderUp className="w-4 h-4" />
                选择文件夹
              </button>
            </div>
          </div>

          {/* Hidden inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            {...{ webkitdirectory: '', directory: '' }}
            className="hidden"
            onChange={handleFolderSelect}
          />

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">
                  待上传文件 ({files.length})
                </h3>
                {!uploading && (
                  <button
                    onClick={() => setFiles([])}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    清空列表
                  </button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {f.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                      {f.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
                      {(f.status === 'pending' || f.status === 'uploading') && (
                        <div className={`w-4 h-4 shrink-0 rounded-full border-2 ${f.status === 'uploading' ? 'border-blue-500 border-t-transparent animate-spin' : 'border-gray-300'}`} />
                      )}
                      <span className="truncate text-gray-700" title={f.relativePath}>
                        {f.relativePath}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs text-gray-400">
                        {formatFileSize(f.file.size)}
                      </span>
                      {!uploading && f.status === 'pending' && (
                        <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload result */}
          {uploadResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${
              uploadResult.success
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {uploadResult.success ? '✅' : '❌'} {uploadResult.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            {uploadResult?.success ? '关闭' : '取消'}
          </button>
          {!uploadResult?.success && (
            <button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  上传 {files.length > 0 ? `(${files.length})` : ''}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
