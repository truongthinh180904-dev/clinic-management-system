<?php

namespace App\Http\Resources;

use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Notification
 */
class NotificationResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $createdAt = $this->created_at instanceof \DateTimeInterface
            ? $this->created_at->toIso8601String()
            : ($this->created_at ? (string) $this->created_at : null);

        $readAt = $this->read_at instanceof \DateTimeInterface
            ? $this->read_at->toIso8601String()
            : ($this->read_at ? (string) $this->read_at : null);

        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'user' => new UserResource($this->whenLoaded('user')),
            'type' => $this->type,
            'title' => $this->title,
            'message' => $this->message,
            'reference_type' => $this->reference_type,
            'reference_id' => $this->reference_id,
            'is_read' => (bool) $this->is_read,
            'read_at' => $readAt,
            'created_at' => $createdAt,
        ];
    }
}
