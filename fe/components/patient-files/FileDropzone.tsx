'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, File, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.doc', '.docx', '.dcm'];

interface FileDropzoneProps {
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  uploadProgress: number;
  disabled?: boolean;
}

export function FileDropzone({
  onUpload,
  isUploading,
  uploadProgress,
  disabled = false,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndProcessFile = async (file: File) => {
    setErrorMessage(null);

    // Validate size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`Dung lượng tệp (${(file.size / 1024 / 1024).toFixed(2)} MB) vượt quá giới hạn tối đa 10 MB.`);
      return;
    }

    // Validate extension
    const nameLower = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => nameLower.endsWith(ext));
    if (!hasValidExt) {
      setErrorMessage(
        'Định dạng tệp không được hỗ trợ. Vui lòng tải lên tệp PDF, Ảnh (JPEG, PNG, WEBP, TIFF), DICOM hoặc Tài liệu Word.'
      );
      return;
    }

    setSelectedFileName(file.name);
    try {
      await onUpload(file);
      setSelectedFileName(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Tải lên thất bại. Vui lòng thử lại.';
      setErrorMessage(msg);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await validateAndProcessFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await validateAndProcessFile(file);
    }
  };

  return (
    <div className="w-full space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled && !isUploading && inputRef.current) {
            inputRef.current.click();
          }
        }}
        className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all cursor-pointer select-none text-center ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 scale-[1.005]'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-slate-100/70 dark:hover:bg-slate-900/80 hover:border-slate-400'
        } ${disabled || isUploading ? 'pointer-events-none opacity-75' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.tiff,.doc,.docx,.dcm,application/pdf,image/*"
          onChange={handleFileChange}
          disabled={disabled || isUploading}
          className="hidden"
        />

        {isUploading ? (
          <div className="w-full max-w-md py-2 space-y-3">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang tải lên: {selectedFileName}</span>
              </span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {uploadProgress}%
              </span>
            </div>

            {/* Live Progress Bar */}
            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-200 ease-out"
                style={{ width: `${Math.min(100, Math.max(5, uploadProgress))}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
              Đang bảo mật và xử lý tệp y tế...
            </p>
          </div>
        ) : (
          <>
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 shadow-xs">
              <UploadCloud className="h-6 w-6" />
            </div>

            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Kéo và thả tệp tài liệu y tế vào đây, hoặc{' '}
              <span className="text-blue-600 dark:text-blue-400 underline underline-offset-2">
                duyệt từ máy tính
              </span>
            </p>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              Hỗ trợ: PDF kết quả, Ảnh X-quang, MRI, Siêu âm (JPG, PNG, WEBP), Word, DICOM • Tối đa 10 MB/tệp
            </p>
          </>
        )}
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg animate-in fade-in duration-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Không thể tải lên: </span>
            {errorMessage}
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-700 text-sm font-bold ml-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
