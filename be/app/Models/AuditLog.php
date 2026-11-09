<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;

#[Fillable([
    'user_id',
    'module',
    'action',
    'table_name',
    'record_id',
    'old_values',
    'new_values',
    'ip_address',
    'user_agent',
    'created_at',
])]
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    /**
     * Enforce append-only immutability.
     */
    protected static function booted(): void
    {
        static::updating(function () {
            throw new \RuntimeException('Nhật ký kiểm toán là dữ liệu bất biến (append-only), không thể cập nhật hoặc sửa đổi.');
        });

        static::deleting(function () {
            throw new \RuntimeException('Nhật ký kiểm toán là dữ liệu bất biến (append-only), không thể xóa bỏ.');
        });
    }

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Record an audit log entry.
     */
    public static function record(
        string $module,
        string $action,
        string $tableName,
        string|int|null $recordId = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?Request $request = null,
        ?int $userId = null
    ): self {
        $req = $request ?? (request() instanceof Request ? request() : null);

        return static::create([
            'user_id' => $userId ?? $req?->user()?->id,
            'module' => $module,
            'action' => $action,
            'table_name' => $tableName,
            'record_id' => $recordId !== null ? (string) $recordId : null,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => $req?->ip(),
            'user_agent' => $req?->userAgent(),
            'created_at' => now(),
        ]);
    }
}
