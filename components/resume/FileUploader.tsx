'use client';

// components/FileUploader.tsx
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploaderProps {
  onFileSelect?: (file: File | null) => void;
}

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function FileUploader({ onFileSelect }: FileUploaderProps) {
  const [dragError, setDragError] = useState<string>('');

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setDragError('');
    
    if (rejectedFiles.length > 0) {
      const error = rejectedFiles[0].errors[0];
      if (error.code === 'file-too-large') {
        setDragError('File is too large. Maximum size is 20MB.');
      } else if (error.code === 'file-invalid-type') {
        setDragError('Only PDF files are allowed.');
      } else {
        setDragError('File upload error. Please try again.');
      }
      return;
    }

    const file = acceptedFiles[0] || null;
    onFileSelect?.(file);
  }, [onFileSelect]);

  const maxFileSize = 20 * 1024 * 1024; // 20MB in bytes

  const { getRootProps, getInputProps, isDragActive, acceptedFiles, isDragReject } = useDropzone({
    onDrop,
    multiple: false,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: maxFileSize,
  });

  const file = acceptedFiles[0] || null;

  return (
    <div className="w-full">
      <div 
        className={`border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${
          isDragActive && !isDragReject
            ? 'border-blue-400 bg-blue-50' 
            : isDragReject || dragError
            ? 'border-red-400 bg-red-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <div {...getRootProps()}>
          <input {...getInputProps()} />

          <div className="space-y-4 cursor-pointer">
            {file ? (
              <div 
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors" 
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {file.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDragError('');
                    onFileSelect?.(null);
                  }}
                  title="Remove file"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="mx-auto w-16 h-16 flex items-center justify-center mb-4">
                  {isDragActive ? (
                    <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                  ) : (
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  )}
                </div>
                
                {isDragActive ? (
                  <p className="text-lg text-blue-600 font-medium">
                    Drop your PDF here
                  </p>
                ) : (
                  <>
                    <p className="text-lg text-gray-600 mb-1">
                      <span className="font-semibold text-blue-600 hover:text-blue-700">
                        Click to upload
                      </span> or drag and drop
                    </p>
                    <p className="text-sm text-gray-500">
                      PDF files only (max {formatSize(maxFileSize)})
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {dragError && (
        <p className="mt-2 text-sm text-red-600 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {dragError}
        </p>
      )}
    </div>
  );
}