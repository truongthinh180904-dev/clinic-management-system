'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Upload,
  Search,
  Filter,
  RefreshCw,
  FolderOpen,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Plus,
} from 'lucide-react';
import { PatientFile } from '@/types/patient-file';
import {
  deletePatientFile,
  getPatientFiles,
  getVisitFiles,
  uploadPatientFile,
  uploadVisitFile,
} from '@/lib/api/patient-files';
import { FileDropzone } from './FileDropzone';
import { PatientFileCard } from './PatientFileCard';
import { FilePreviewModal } from './FilePreviewModal';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/toast';

interface PatientFileManagerProps {
  patientId: number | string;
  patientName?: string;
  visitId?: number | string | null;
  title?: string;
  canUpload?: boolean;
  canDelete?: boolean;
  canView?: boolean;
  compact?: boolean;
  onFilesChanged?: (files: PatientFile[]) => void;
}

export function PatientFileManager({
  patientId,
  patientName,
  visitId,
  title = 'Quản lý tài liệu & tệp y tế',
  canUpload = true,
  canDelete = true,
  canView = true,
  compact = false,
  onFilesChanged,
}: PatientFileManagerProps) {
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search & Type Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'IMAGE' | 'PDF' | 'OTHER'>('ALL');

  // Upload state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showUploadZone, setShowUploadZone] = useState<boolean>(!compact);

  // Preview Modal
  const [previewFile, setPreviewFile] = useState<PatientFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  // Delete Confirmation Modal
  const [fileToDelete, setFileToDelete] = useState<PatientFile | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Fetch files
  const fetchFiles = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      let res;
      if (visitId) {
        res = await getVisitFiles(visitId);
      } else {
        res = await getPatientFiles(patientId, {
          search: searchTerm || undefined,
        });
      }
      const data = res.data || [];
      setFiles(data);
      onFilesChanged?.(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách tệp y tế.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [patientId, visitId]);

  // Handle file upload
  const handleUploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      if (visitId) {
        await uploadVisitFile(visitId, file, (progress) => {
          setUploadProgress(progress);
        });
      } else {
        await uploadPatientFile(patientId, file, visitId, (progress) => {
          setUploadProgress(progress);
        });
      }

      toast.success('Tải lên tài liệu y tế thành công!', {
        description: `Tệp "${file.name}" đã được lưu trữ an toàn trong hồ sơ bệnh án.`,
      });

      await fetchFiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Tải lên thất bại';
      toast.error('Lỗi khi tải tệp y tế', {
        description: msg,
      });
      throw err;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle delete file
  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);

    try {
      await deletePatientFile(fileToDelete.id);
      toast.success('Xóa tệp đính kèm thành công!', {
        description: `Tệp "${fileToDelete.file_name}" đã được xóa khỏi hệ thống.`,
      });
      setFileToDelete(null);
      await fetchFiles();
    } catch (err) {
      toast.error('Không thể xóa tệp', {
        description: err instanceof Error ? err.message : 'Đã xảy ra lỗi khi xóa.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered files
  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      // Search text
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = f.file_name.toLowerCase().includes(term);
        const matchesVisit = f.visit?.visit_code.toLowerCase().includes(term);
        if (!matchesName && !matchesVisit) return false;
      }

      // Type filter
      if (filterType === 'IMAGE') {
        const isImg =
          f.mime_type.startsWith('image/') ||
          /\.(jpg|jpeg|png|webp|tiff|gif)$/i.test(f.file_name);
        return isImg;
      }
      if (filterType === 'PDF') {
        const isPdf =
          f.mime_type.includes('pdf') || f.file_name.toLowerCase().endsWith('.pdf');
        return isPdf;
      }
      if (filterType === 'OTHER') {
        const isImg =
          f.mime_type.startsWith('image/') ||
          /\.(jpg|jpeg|png|webp|tiff|gif)$/i.test(f.file_name);
        const isPdf =
          f.mime_type.includes('pdf') || f.file_name.toLowerCase().endsWith('.pdf');
        return !isImg && !isPdf;
      }

      return true;
    });
  }, [files, searchTerm, filterType]);

  const counts = useMemo(() => {
    let images = 0;
    let pdfs = 0;
    let others = 0;
    files.forEach((f) => {
      const isImg =
        f.mime_type.startsWith('image/') ||
        /\.(jpg|jpeg|png|webp|tiff|gif)$/i.test(f.file_name);
      const isPdf =
        f.mime_type.includes('pdf') || f.file_name.toLowerCase().endsWith('.pdf');
      if (isImg) images++;
      else if (isPdf) pdfs++;
      else others++;
    });
    return { total: files.length, images, pdfs, others };
  }, [files]);

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {title}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              {counts.total} tệp
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Quản lý và lưu trữ an toàn ảnh X-quang, MRI, kết quả xét nghiệm và tài liệu y khoa{' '}
            {patientName ? `của bệnh nhân ${patientName}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canUpload && (
            <button
              type="button"
              onClick={() => setShowUploadZone((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all shadow-xs ${
                showUploadZone
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {showUploadZone ? (
                <>
                  <X className="h-4 w-4" />
                  <span>Ẩn khung tải</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Tải tệp mới</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={fetchFiles}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Làm mới danh sách tệp"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Drag & Drop Upload Zone (Collapsible or visible) */}
      {showUploadZone && canUpload && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5 text-blue-600" />
              Tải lên tài liệu y tế mới
            </span>
            {visitId && (
              <span className="text-xs font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                Gắn trực tiếp vào Lượt khám #{visitId}
              </span>
            )}
          </div>

          <FileDropzone
            onUpload={handleUploadFile}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
          />
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Tất cả ({counts.total})
          </button>

          <button
            type="button"
            onClick={() => setFilterType('IMAGE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              filterType === 'IMAGE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Ảnh / X-quang ({counts.images})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('PDF')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              filterType === 'PDF'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>PDF ({counts.pdfs})</span>
          </button>

          {counts.others > 0 && (
            <button
              type="button"
              onClick={() => setFilterType('OTHER')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterType === 'OTHER'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Khác ({counts.others})
            </button>
          )}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên tệp, lượt khám..."
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* File Grid Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
          <p className="mt-3 text-xs text-slate-500">Đang tải danh sách tệp đính kèm...</p>
        </div>
      ) : errorMsg ? (
        <div className="p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto" />
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{errorMsg}</p>
          <button
            type="button"
            onClick={fetchFiles}
            className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700"
          >
            Thử lại
          </button>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center">
          <div className="h-14 w-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-500 flex items-center justify-center mb-3">
            <FolderOpen className="h-8 w-8" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {searchTerm || filterType !== 'ALL'
              ? 'Không tìm thấy tệp phù hợp'
              : 'Chưa có tệp tài liệu y tế nào'}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
            {searchTerm || filterType !== 'ALL'
              ? 'Vui lòng thay đổi từ khóa tìm kiếm hoặc bỏ lọc định dạng.'
              : 'Hãy kéo thả tệp hoặc bấm nút Tải tệp mới để đính kèm kết quả X-quang, MRI hoặc hồ sơ liên quan.'}
          </p>
          {!showUploadZone && canUpload && (
            <button
              type="button"
              onClick={() => setShowUploadZone(true)}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              Mở khung tải lên
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredFiles.map((file) => (
            <PatientFileCard
              key={file.id}
              file={file}
              canDelete={canDelete}
              onPreview={(f) => {
                setPreviewFile(f);
                setIsPreviewOpen(true);
              }}
              onDelete={(f) => setFileToDelete(f)}
            />
          ))}
        </div>
      )}

      {/* Image & PDF Viewer Modal */}
      <FilePreviewModal
        file={previewFile}
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewFile(null);
        }}
      />

      {/* Delete Confirmation Modal */}
      <AlertDialog
        open={!!fileToDelete}
        onOpenChange={(open) => {
          if (!open) setFileToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
              <AlertDialogTitle>Xác nhận xóa tệp tài liệu y tế</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-slate-600 dark:text-slate-300">
              Bạn có chắc chắn muốn xóa tệp{' '}
              <strong className="text-slate-900 dark:text-white font-mono">
                {fileToDelete?.file_name}
              </strong>{' '}
              khỏi hồ sơ bệnh án? Hành động này sẽ được ghi nhận vào nhật ký kiểm toán (Audit Log) và không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy bỏ</AlertDialogCancel>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
