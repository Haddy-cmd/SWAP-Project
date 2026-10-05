import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { AUTO_CLOSE_MS, FeedbackProvider, useFeedback, type ConfirmInput } from '@/components/feedback/FeedbackProvider'

/** Buttons that drive the feedback layer the way pages do. */
function Harness({ onAnswer, ask }: { onAnswer?: (ok: boolean) => void; ask?: ConfirmInput }) {
  const { notify, notifyError, confirm } = useFeedback()
  return (
    <>
      <button onClick={() => notify({ title: 'Hours verified', detail: 'Amina · 4h' })}>ok</button>
      <button onClick={() => notifyError({ message: 'This log was already verified.' }, 'Could not verify the hours')}>fail</button>
      <button onClick={async () => onAnswer?.(await confirm(ask ?? { title: 'Verify 3 logs?', confirmLabel: 'Verify' }))}>ask</button>
    </>
  )
}

const renderIt = (props: Parameters<typeof Harness>[0] = {}) => render(<FeedbackProvider><Harness {...props} /></FeedbackProvider>)

afterEach(() => vi.useRealTimers())

describe('FeedbackProvider', () => {
  it('shows a success pop-out that closes by itself', () => {
    vi.useFakeTimers()
    renderIt()
    fireEvent.click(screen.getByText('ok'))

    expect(screen.getByRole('status')).toHaveTextContent('Hours verified')
    expect(screen.getByText('Amina · 4h')).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(AUTO_CLOSE_MS + 10) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps an error until OK, with the server message', () => {
    vi.useFakeTimers()
    renderIt()
    fireEvent.click(screen.getByText('fail'))

    act(() => { vi.advanceTimersByTime(AUTO_CLOSE_MS * 3) })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Could not verify the hours')
    expect(alert).toHaveTextContent('This log was already verified.')

    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('closes on Escape', () => {
    renderIt()
    fireEvent.click(screen.getByText('ok'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('confirm resolves true only on the confirm button, and lists the warnings', async () => {
    const onAnswer = vi.fn()
    renderIt({ onAnswer, ask: { title: 'Reject these hours?', details: ['They won’t count.'], confirmLabel: 'Reject', tone: 'danger' } })

    fireEvent.click(screen.getByText('ask'))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Reject these hours?')
    expect(screen.getByText('They won’t count.')).toBeInTheDocument()
    // Danger dialogs start on Cancel.
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })) })
    expect(onAnswer).toHaveBeenLastCalledWith(false)

    fireEvent.click(screen.getByText('ask'))
    await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }) })
    expect(onAnswer).toHaveBeenLastCalledWith(false)

    fireEvent.click(screen.getByText('ask'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reject' })) })
    expect(onAnswer).toHaveBeenLastCalledWith(true)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
