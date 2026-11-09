'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  Eye,
  FileText,
  AlertCircle,
  ExternalLink,
  Contrast,
  Loader2,
  Calendar,
  User,
  Activity,
} from 'lucide-react';
import { PatientFile } from '@/types/patient-file';
import { downloadPatientFile, getPatientFileBlob } from '@/lib/api/patient-files';

interface FilePreviewModalProps {
  file: PatientFile | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FilePreviewModal({ file, isOpen, onClose }: FilePreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Image controls state
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isInverted, setIsInverted] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !file) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
      setBlobUrl(null);
      setZoom(1);
      setRotation(0);
      setIsInverted(false);
      setLoadError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);
    setZoom(1);
    setRotation(0);
    setIsInverted(false);

    getPatientFileBlob(file.id)
      .then(({ blobUrl: url, mimeType: mime }) => {
        if (!isMounted) {
          URL.revokeObjectURL(url);
          return;
        }
        setBlobUrl(url);
        setMimeType(mime || file.mime_type);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setIsLoading(false);
        setLoadError(err instanceof Error ? err.message : 'Không thể tải tệp tin.');
      });

    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, file?.id]);

  if (!isOpen || !file) return null;

  const isImage =
    mimeType.startsWith('image/') ||
    file.mime_type.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|tiff|gif|bmp)$/i.test(file.file_name);

  const isPdf =
    mimeType.includes('pdf') ||
    file.mime_type.includes('pdf') ||
    file.file_name.toLowerCase().endsWith('.pdf');

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
    setIsInverted(false);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleToggleInvert = () => setIsInverted((prev) => !prev);

  const handleDownload = async () => {
    if (!file) return;
    setIsDownloading(true);
    try {
      await downloadPatientFile(file.id, file.file_name);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Tải xuống thất bại');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div className="relative flex flex-col w-full max-w-6xl h-[92vh] max-h-[900px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold">
              {isImage ? '🖼️' : isPdf ? '📄' : '📁'}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white truncate" title={file.file_name}>
                {file.file_name}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                <span>{file.file_size_formatted}</span>
                <span>•</span>
                <span>{file.mime_type}</span>
                {file.visit && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                      <Activity className="h-3 w-3" />
                      Lượt khám: {file.visit.visit_code}
                    </span>
                  </>
                )}
                {file.uploader && (
                  <>
                    <span>•</span>
                    <span className="text-slate-600 dark:text-slate-400">
                      Tải lên bởi: {file.uploader.username}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isImage && (
              <div className="hidden sm:flex items-center bg-slate-200/80 dark:bg-slate-800 rounded-lg p-1 gap-1">
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors"
                  title="Phóng to (+25%)"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors"
                  title="Thu nhỏ (-25%)"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRotate}
                  className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors"
                  title="Xoay ảnh 90°"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleToggleInvert}
                  className={`p-1.5 rounded-md transition-colors ${
                    isInverted
                      ? 'bg-amber-500 text-white font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                  }`}
                  title="Đảo âm bản X-quang (Negative Contrast)"
                >
                  <Contrast className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors text-xs font-mono"
                  title="Đặt lại kích thước ban đầu"
                >
                  {Math.round(zoom * 100)}%
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-60"
              title="Tải tệp này về máy tính"
            >
              {isDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Tải về</span>
            </button>

            {blobUrl && (
              <a
                href={blobUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Mở trong tab mới"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors ml-1"
              title="Đóng modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Preview Content Area */}
        <div className="relative flex-1 w-full bg-slate-900/95 overflow-hidden flex items-center justify-center select-none">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-8 text-white space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm font-medium text-slate-300">
                Đang giải mã và kết nối dữ liệu y tế...
              </p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md space-y-3">
              <AlertCircle className="h-10 w-10 text-rose-500" />
              <h4 className="text-base font-bold text-white">Không thể xem trước tệp tin</h4>
              <p className="text-xs text-slate-400">{loadError}</p>
              <button
                type="button"
                onClick={handleDownload}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
              >
                <Download className="h-4 w-4" />
                Tải tệp về máy để xem
              </button>
            </div>
          ) : isImage && blobUrl ? (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              {/* Image Preview with Zoom, Rotate and X-Ray Invert Filters */}
              <img
                src={blobUrl}
                alt={file.file_name}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  filter: isInverted ? 'invert(100%) contrast(150%)' : 'none',
                  transition: 'transform 0.15s ease-out',
                }}
                className="max-w-full max-h-full object-contain rounded-md shadow-2xl origin-center"
              />
            </div>
          ) : isPdf && blobUrl ? (
            <div className="w-full h-full bg-slate-800">
              <object
                data={blobUrl}
                type="application/pdf"
                className="w-full h-full border-none"
              >
                <iframe
                  src={blobUrl}
                  title={file.file_name}
                  className="w-full h-full border-none"
                >
                  <div className="flex flex-col items-center justify-center h-full text-white p-6 space-y-3">
                    <FileText className="h-12 w-12 text-slate-400" />
                    <p className="text-sm">Trình duyệt không hỗ trợ xem trực tiếp PDF.</p>
                    <a
                      href={blobUrl}
                      download={file.file_name}
                      className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg"
                    >
                      Nhấn vào đây để tải PDF về
                    </a>
                  </div>
                </iframe>
              </object>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-3">
              <div className="h-16 w-16 rounded-2xl bg-slate-800 text-slate-300 flex items-center justify-center">
                <FileText className="h-8 w-8" />
              </div>
              <h4 className="text-base font-semibold text-white">Định dạng tài liệu văn phòng</h4>
              <p className="text-xs text-slate-400 max-w-sm">
                Tệp này ({file.mime_type}) không thể xem trực tiếp qua trình xem ảnh/PDF. Vui lòng tải về máy để mở bằng ứng dụng tương thích.
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-md"
              >
                <Download className="h-4 w-4" />
                Tải tệp tin về máy
              </button>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Ngày tải lên: {new Date(file.created_at).toLocaleString('vi-VN')}</span>
          </div>
          {isImage && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="hidden sm:inline">💡 Phím xoay & Âm bản hỗ trợ chuyên sâu cho phim chụp X-quang, MRI, Siêu âm</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
