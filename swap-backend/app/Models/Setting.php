<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $fillable = ['key', 'value'];

    public $timestamps = true;

    /** Read a setting value, returning $default when the key is missing. */
    public static function get(string $key, $default = null)
    {
        return static::query()->where('key', $key)->value('value') ?? $default;
    }

    /** Create or update a setting value. */
    public static function put(string $key, $value): void
    {
        static::query()->updateOrCreate(['key' => $key], ['value' => (string) $value]);
    }

    /** Read a setting as a boolean ("1"/"true"/"on" => true). */
    public static function bool(string $key, bool $default = false): bool
    {
        $value = static::get($key);
        return $value === null ? $default : filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }
}
