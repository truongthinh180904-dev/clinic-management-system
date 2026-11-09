'use client';

import React, { useEffect, useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Download,
  Eye,
  Trash2,
  Calendar,
  User,
  Activity,
  FileCheck,
  Loader2,
} from 'lucide-react';
import { PatientFile } from '@/types/patient-file';
import { downloadPatientFile, getPatientFileBlob } from '@/lib/api/patient-files';

interface PatientFileCardProps {
  file: PatientFile;
  onPreview: (file: PatientFile) => void;
  onDelete?: (file: PatientFile) => void;
  canDelete?: boolean;
}

export function PatientFileCard({
  file,
  onPreview,
  onDelete,
  canDelete = false,
}: PatientFileCardProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const isImage =
    file.mime_type.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|tiff|gif)$/i.test(file.file_name);

  const isPdf =
    file.mime_type.includes('pdf') ||
    file.file_name.toLowerCase().endsWith('.pdf');

  // Load thumbnail for images
  useEffect(() => {
    let isMounted = true;
    if (isImage) {
      getPatientFileBlob(file.id)
        .then(({ blobUrl }) => {
          if (isMounted) {
            setThumbUrl(blobUrl);
          } else {
            URL.revokeObjectURL(blobUrl);
          }
        })
        .catch(() => {
          // ignore thumbnail fail
        });
    }

    return () => {
      isMounted = false;
      if (thumbUrl) {
        URL.revokeObjectURL(thumbUrl);
      }
    };
  }, [file.id, isImage]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    try {
      await downloadPatientFile(file.id, file.file_name);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Tải xuống thất bại');
    } finally {
      setIsDownloading(false);
    }
  };

  const formattedDate = new Date(file.created_at).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      onClick={() => onPreview(file)}
      className="group relative flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer"
    >
      {/* Thumbnail or File Header */}
      <div className="relative w-full h-36 bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center overflow-hidden border-b border-slate-100 dark:border-slate-800">
        {isImage && thumbUrl ? (
          <img
            src={thumbUrl}
            alt={file.file_name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : isImage ? (
          <div className="flex flex-col items-center justify-center text-blue-500 space-y-1">
            <ImageIcon className="h-10 w-10 opacity-70" />
            <span className="text-[11px] font-semibold text-slate-500">Hình ảnh / X-quang</span>
          </div>
        ) : isPdf ? (
          <div className="flex flex-col items-center justify-center text-rose-500 space-y-1">
            <div className="h-12 w-12 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <FileText className="h-7 w-7" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Tài liệu PDF
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-blue-600 dark:text-blue-400 space-y-1">
            <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center">
              <FileCheck className="h-7 w-7" />
            </div>
            <span className="text-[11px] font-medium text-slate-500">Tài liệu đính kèm</span>
          </div>
        )}

        {/* Hover overlay preview button */}
        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/90 text-slate-900 text-xs font-semibold shadow-md">
            <Eye className="h-3.5 w-3.5 text-blue-600" />
            Xem trước
          </span>
        </div>

        {/* Badges on Thumbnail */}
        <div className="absolute top-2 right-2">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-900/70 text-white backdrop-blur-xs">
            {file.file_size_formatted}
          </span>
        </div>
      </div>

      {/* Body Info */}
      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
        <div>
          <h4
            className="text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            title={file.file_name}
          >
            {file.file_name}
          </h4>

          {file.visit && (
            <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <Activity className="h-3 w-3" />
              <span>{file.visit.visit_code}</span>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1 text-slate-400">
            <Calendar className="h-3 w-3" />
            <span>{formattedDate}</span>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Tải về máy tính"
            >
              {isDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
            </button>

            {canDelete && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(file)}
                className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                title="Xóa tệp đính kèm này"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
