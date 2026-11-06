<?php

namespace App\Support;

/**
 * One school year + semester, or every term when both are null (Admin → Analytics
 * "All semesters"). apply() filters a query only when a term is given.
 */
class TermScope
{
    public const ALL_LABEL = 'All semesters';

    public static function isAll(?string $ay, ?string $sem): bool
    {
        return $ay === null || $sem === null;
    }

    /** @template T  @param T $query  @return T */
    public static function apply($query, ?string $ay, ?string $sem, string $table = '')
    {
        if (self::isAll($ay, $sem)) {
            return $query;
        }
        $prefix = $table === '' ? '' : "{$table}.";

        return $query->where("{$prefix}academic_year", $ay)->where("{$prefix}semester", $sem);
    }

    public static function label(?string $ay, ?string $sem): string
    {
        return self::isAll($ay, $sem) ? self::ALL_LABEL : "{$sem} {$ay}";
    }

    /** Validation for an optional term: both or neither. */
    public static function rules(): array
    {
        return [
            'academic_year' => ['nullable', 'string', 'required_with:semester'],
            'semester' => ['nullable', 'string', 'required_with:academic_year'],
        ];
    }
}
