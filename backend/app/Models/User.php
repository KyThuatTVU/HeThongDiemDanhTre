<?php
declare(strict_types=1);

namespace App\Models;

final class User extends Model
{
    public $id;
    public $role_id;
    public $username;
    public $email;
    public $google_id;
    public $password_hash;
    public $full_name;
    public $phone;
    public $avatar_path;
    public $status;
    public $last_login_at;
    public $created_at;
    public $updated_at;
    public $role_key;
    public $role_name;
}
