import { describe, expect, it } from 'vitest'
import * as m from './messages'

// Every catalog text is compared with the string written here (screens.md §Message catalog).
describe('gallery messages', () => {
  it('the listing failure notice', () => {
    expect(m.failureCouldNotList()).toBe("The Gallery couldn't be read. Try again.")
  })

  it('failure notices name the Work', () => {
    expect(m.failureWorkDamaged('Cat.png')).toBe(
      "“Cat.png” can't be opened: its stored data is damaged.",
    )
    expect(m.failureCouldNotDelete('Cat.png')).toBe("“Cat.png” couldn't be deleted. Try again.")
    expect(m.failureCouldNotOpen('Cat.png')).toBe("“Cat.png” couldn't be opened. Try again.")
    expect(m.failureWorkDamaged('Untitled')).toBe(
      "“Untitled” can't be opened: its stored data is damaged.",
    )
  })

  it('the action of the damaged notice reads Delete…', () => {
    expect(m.damagedNoticeAction()).toBe('Delete…')
  })

  it('hints', () => {
    expect(m.hintToolOpen()).toBe('Apply or cancel the open tool first.')
    expect(m.hintOpenWorkCannotBeDeleted()).toBe(
      "The open Work can't be deleted. Open another image first.",
    )
    expect(m.hintChooseWhileExporting()).toBe('Wait for the export to finish, then choose a Work.')
    expect(m.hintChooseWhileConfirming()).toBe(
      'Answer the open question first, then choose a Work.',
    )
  })

  it('storage lines', () => {
    expect(m.storageLinePersisted()).toBe(
      'Works are kept in this browser. Export a Work to keep a copy elsewhere.',
    )
    expect(m.storageLineNotPersisted()).toBe(
      'Works are saved in this browser only, and the browser may clear them when space runs low. Export to keep a copy.',
    )
  })

  it('labels', () => {
    expect(m.countLabel(3)).toBe('3 of 20 places used')
    expect(m.countLabel(0)).toBe('0 of 20 places used')
    expect(m.statusOpen()).toBe('Open')
    expect(m.statusDamaged()).toBe('Damaged')
    expect(m.damagedThumbnail()).toBe("Can't be read")
    expect(m.emptyState()).toBe('Works you open will appear here.')
  })

  it('unavailable title and each reason body', () => {
    expect(m.unavailableTitle()).toBe('The Gallery is unavailable in this window.')
    expect(m.unavailableBody('refused')).toBe(
      "This browser isn't letting the editor keep anything for this site, for example because site data is blocked. You can still open, edit and export images, but nothing is kept after this page closes.",
    )
    expect(m.unavailableBody('held')).toBe(
      'Another tab of the editor is holding the Gallery. Close the other tabs of the editor, then reload this page.',
    )
    expect(m.unavailableBody('newer-version')).toBe(
      'A newer version of the editor is open in another tab. Reload this page to use the Gallery.',
    )
  })

  it('delete dialog, spinner and buttons', () => {
    expect(m.deleteDialogTitle('Cat.png')).toBe('Delete “Cat.png”?')
    expect(m.deleteDialogBody()).toBe(
      "It can't be brought back. An Export is the only copy kept outside this browser.",
    )
    expect(m.deleteDialogCancel()).toBe('Cancel')
    expect(m.deleteDialogConfirm()).toBe('Delete')
    expect(m.reopeningLabel('Cat.png')).toBe('Opening Cat.png')
    expect(m.galleryButton()).toBe('Gallery')
    expect(m.closeButton()).toBe('Close')
    expect(m.closeTooltip()).toBe('Close (Esc)')
    expect(m.deleteButtonName('Cat.png')).toBe('Delete “Cat.png”')
  })
})
