'use client';

// components/FileUploader.tsx
import { useState, useCallback } from 'react';
import { useDropzone, FileRejection, DropzoneOptions } from 'react-dropzone';

interface FileUploaderProps {
  onFileSelect?: (file: File | null) => void;
  accept?: string; // comma-separated MIME types / extensions (optional - defaults to PDF + Word)
}

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Convert the comma-separated accept string from the parent into the
// react-dropzone { mimeType: [ext, ...] } object format.
function parseAccept(accept: string): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  accept.split(',').map(s => s.trim()).forEach(token => {
    if (token.startsWith('.')) {
      // extension - attach to a wildcard bucket so dropzone keeps it
      map['application/octet-stream'] = [...(map['application/octet-stream'] ?? []), token];
    } else {
      // MIME type
      map[token] = map[token] ?? [];
    }
  });
  return map;
}

const DEFAULT_ACCEPT =
  'application/pdf,.pdf,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,' +
  'application/msword,.doc';

export default function FileUploader({ onFileSelect, accept = DEFAULT_ACCEPT }: FileUploaderProps) {
  const [dragError, setDragError] = useState<string>('');

  const isWordFile = (f: File) => {
    const n = f.name.toLowerCase();
    return (
      n.endsWith('.docx') ||
      n.endsWith('.doc')  ||
      f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      f.type === 'application/msword'
    );
  };

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    setDragError('');

    if (rejectedFiles.length > 0) {
      const error = rejectedFiles[0].errors[0];
      if (error.code === 'file-too-large') {
        setDragError('File is too large. Maximum size is 10 MB.');
      } else if (error.code === 'file-invalid-type') {
        setDragError('Only PDF or Word documents (.pdf, .docx, .doc) are allowed.');
      } else {
        setDragError('File upload error. Please try again.');
      }
      return;
    }

    const file = acceptedFiles[0] || null;
    onFileSelect?.(file);
  }, [onFileSelect]);

  const maxFileSize = 10 * 1024 * 1024; // 10 MB

  const dropzoneOptions: DropzoneOptions = {
    onDrop,
    multiple: false,
    accept: parseAccept(accept),
    maxSize: maxFileSize,
  };

  const { getRootProps, getInputProps, isDragActive, acceptedFiles, isDragReject } = useDropzone(dropzoneOptions);

  const file = acceptedFiles[0] || null;
  const fileLabel = file ? (isWordFile(file) ? 'Word' : 'PDF') : '';

  return (
    <div className="w-full">
      <div {...getRootProps()}
        className={`rounded-xl transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
          file ? '' : `border border-dashed p-5 ${
            isDragActive && !isDragReject ? 'border-white/40 bg-white/[0.04]'
            : isDragReject || dragError ? 'border-rose-500/50 bg-rose-500/[0.05]'
            : 'border-white/[0.14] hover:border-white/[0.26] hover:bg-white/[0.02]'}`}`}>
        <input {...getInputProps()} />
        {file ? (
          <div className="flex items-center gap-3.5 p-3 pr-2 rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02]" onClick={e => e.stopPropagation()}>
            <span className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] text-[var(--text-2)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] text-white truncate">{file.name}</p>
              <p className="text-[11.5px] text-[var(--text-4)] mt-0.5">{formatSize(file.size)} · {fileLabel}</p>
            </div>
            <button type="button" title="Remove file"
              className="h-8 px-3 rounded-lg text-[12.5px] font-medium text-[var(--text-4)] hover:text-rose-300 hover:bg-rose-500/[0.08] transition-colors"
              onClick={e => { e.stopPropagation(); setDragError(''); onFileSelect?.(null); }}>
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/[0.04] text-[var(--text-3)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] text-white">{isDragActive ? 'Drop your file here' : 'Drag your resume here, or choose a file'}</span>
              <span className="block text-[12px] text-[var(--text-4)] mt-0.5">PDF or Word (.docx, .doc), up to {formatSize(maxFileSize)}</span>
            </span>
            <span className="btn-secondary !h-9 !text-[13px] self-start sm:self-auto">Choose file</span>
          </div>
        )}
      </div>

      {dragError && <p className="mt-2 text-[12.5px] text-rose-300">{dragError}</p>}
    </div>
  );
}
