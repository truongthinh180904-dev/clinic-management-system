<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Bảng 14: service_packages — Gói dịch vụ
     */
    public function up(): void
    {
        Schema::create('service_packages', function (Blueprint $table) {
            $table->id();
            $table->string('package_code', 50)->unique();
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->decimal('price', 15, 2);
            $table->unsignedInteger('total_sessions');
            $table->unsignedInteger('validity_days');
            $table->string('status', 30);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('service_packages');
    }
};
