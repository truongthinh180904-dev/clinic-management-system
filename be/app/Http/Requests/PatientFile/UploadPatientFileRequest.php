<?php

namespace App\Http\Requests\PatientFile;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UploadPatientFileRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'file' => [
                'required',
                'file',
                'max:10240', // Giới hạn tối đa 10MB (10240 KB)
                'mimes:pdf,jpeg,jpg,png,webp,tiff,doc,docx,dicom',
            ],
            'file_name' => ['nullable', 'string', 'max:255'],
            'visit_id' => ['nullable', 'integer', 'exists:visits,id'],
            'description' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * Get custom error messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.required' => 'Vui lòng chọn tệp tin cần tải lên.',
            'file.file' => 'Dữ liệu tải lên phải là một tệp tin hợp lệ.',
            'file.max' => 'Dung lượng tệp tối đa không được vượt quá 10MB.',
            'file.mimes' => 'Định dạng tệp không được hỗ trợ. Chỉ chấp nhận các tệp y tế: PDF, JPG, JPEG, PNG, WEBP, TIFF, DOC, DOCX, DICOM.',
            'visit_id.exists' => 'Lượt khám không tồn tại trong hệ thống.',
        ];
    }
}
