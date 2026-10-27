<?php

namespace App\Providers;

use App\Models\Appointment;
use App\Models\ApprovalRequest;
use App\Models\CashTransaction;
use App\Models\Expense;
use App\Models\InventoryTransaction;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\PatientPackage;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Visit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Relation::morphMap([
            'Payment' => Payment::class,
            'payment' => Payment::class,
            'Expense' => Expense::class,
            'expense' => Expense::class,
            'Invoice' => Invoice::class,
            'invoice' => Invoice::class,
            'ApprovalRequest' => ApprovalRequest::class,
            'approval_request' => ApprovalRequest::class,
            'CashTransaction' => CashTransaction::class,
            'cash_transaction' => CashTransaction::class,
            'InventoryTransaction' => InventoryTransaction::class,
            'inventory_transaction' => InventoryTransaction::class,
            'Product' => Product::class,
            'product' => Product::class,
            'Patient' => Patient::class,
            'patient' => Patient::class,
            'PatientPackage' => PatientPackage::class,
            'patient_package' => PatientPackage::class,
            'Visit' => Visit::class,
            'visit' => Visit::class,
            'Appointment' => Appointment::class,
            'appointment' => Appointment::class,
        ]);
    }
}
