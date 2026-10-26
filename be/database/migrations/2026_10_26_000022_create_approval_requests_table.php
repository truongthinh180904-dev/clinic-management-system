<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Bảng 24: approval_requests — Yêu cầu phê duyệt
     */
    public function up(): void
    {
        Schema::create('approval_requests', function (Blueprint $table) {
            $table->id();
            $table->string('request_type', 100);
            $table->string('reference_type', 100);
            $table->unsignedBigInteger('reference_id');
            $table->foreignId('requested_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 30);
            $table->text('reason')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('approved_at')->nullable();

            $table->index(['reference_type', 'reference_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('approval_requests');
    }
};
