<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Bảng 16: patient_packages — Gói dịch vụ đã cấp cho bệnh nhân
     */
    public function up(): void
    {
        Schema::create('patient_packages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('package_id')->constrained('service_packages')->restrictOnDelete();
            $table->date('purchase_date');
            $table->date('expiry_date')->nullable();
            $table->unsignedInteger('total_sessions');
            $table->unsignedInteger('used_sessions');
            $table->unsignedInteger('remaining_sessions');
            $table->decimal('price', 15, 2);
            $table->string('status', 30);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('patient_packages');
    }
};
