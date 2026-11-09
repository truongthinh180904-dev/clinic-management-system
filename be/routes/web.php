<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/login', function () {
    return response()->json([
        'success' => false,
        'message' => 'Phiên làm việc đã hết hạn hoặc token không hợp lệ. Vui lòng đăng nhập lại.',
        'errors' => null,
    ], 401);
})->name('login');
