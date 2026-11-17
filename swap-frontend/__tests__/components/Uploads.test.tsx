import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { DocumentUpload } from '@/components/application/DocumentUpload'
import { endUpload, getUploads, progressUpload, startUpload, uploadLabel } from '@/lib/uploads/progress'

const fileOf = (name: string, bytes: number, type = 'application/pdf') => {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: bytes })
  return f
}

describe('DocumentUpload', () => {
  it('warns with the limit instead of silently dropping a file that is too big', () => {
    const onChange = vi.fn()
    const { container } = render(<DocumentUpload label="Letter of Intent" maxSizeMb={5} onChange={onChange} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [fileOf('big.pdf', 6.2 * 1024 * 1024)] } })

    expect(onChange).toHaveBeenCalledWith(null)
    expect(screen.getByRole('alert').textContent).toContain('That file is 6.2 MB. Letter of Intent must be 5 MB or smaller.')
  })

  it('warns when a dropped file is a type the field does not take', () => {
    const onChange = vi.fn()
    const { container } = render(<DocumentUpload label="2×2 Photo" accept=".jpg,.jpeg,.png" onChange={onChange} />)
    const zone = container.querySelector('.border-dashed') as HTMLElement

    fireEvent.drop(zone, { dataTransfer: { files: [fileOf('me.pdf', 1000)] } })

    expect(onChange).toHaveBeenCalledWith(null)
    expect(screen.getByRole('alert').textContent).toContain("me.pdf can't be used here. 2×2 Photo must be .jpg, .jpeg, .png.")
  })

  it('takes a file within the limit', () => {
    const onChange = vi.fn()
    const { container } = render(<DocumentUpload label="Grade Card" onChange={onChange} />)
    const file = fileOf('grades.pdf', 1024)
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } })

    expect(onChange).toHaveBeenCalledWith(file)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('upload progress store', () => {
  it('tracks an upload from start to end', () => {
    const form = new FormData()
    form.append('file', fileOf('cor.pdf', 10))
    expect(uploadLabel(form)).toBe('cor.pdf')

    let id = 0
    act(() => { id = startUpload('cor.pdf', 0) })
    act(() => progressUpload(id, 50, 100))
    expect(getUploads().find((u) => u.id === id)).toMatchObject({ loaded: 50, total: 100 })
    act(() => endUpload(id))
    expect(getUploads().find((u) => u.id === id)).toBeUndefined()
  })
})
