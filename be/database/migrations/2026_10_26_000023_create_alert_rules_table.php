<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Bảng 25: alert_rules — Quy tắc cảnh báo
     */
    public function up(): void
    {
        Schema::create('alert_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name', 191);
            $table->string('alert_type', 100);
            $table->decimal('threshold_value', 15, 2)->nullable();
            $table->unsignedInteger('threshold_days')->nullable();
            $table->unsignedInteger('threshold_sessions')->nullable();
            $table->string('status', 30);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('alert_rules');
    }
};
