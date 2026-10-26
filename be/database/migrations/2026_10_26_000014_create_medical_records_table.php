<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Bảng 10: medical_records — Hồ sơ bệnh án
     */
    public function up(): void
    {
        Schema::create('medical_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_id')->unique()->constrained('visits')->restrictOnDelete();
            $table->foreignId('doctor_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->text('medical_history')->nullable();
            $table->text('diagnosis')->nullable();
            $table->text('indication')->nullable();
            $table->text('result')->nullable();
            $table->text('treatment')->nullable();
            $table->date('follow_up_date')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('medical_records');
    }
};
