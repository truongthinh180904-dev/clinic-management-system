<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Bảng 15: package_services — Dịch vụ thành phần của gói
     */
    public function up(): void
    {
        Schema::create('package_services', function (Blueprint $table) {
            $table->foreignId('package_id')->constrained('service_packages')->cascadeOnDelete();
            $table->foreignId('service_id')->constrained('services')->cascadeOnDelete();
            $table->unsignedInteger('quantity');
            $table->timestamp('created_at')->nullable();

            $table->primary(['package_id', 'service_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('package_services');
    }
};
