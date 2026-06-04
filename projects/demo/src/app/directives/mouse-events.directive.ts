import {
  Directive,
  output,
  HostListener,
  type OutputEmitterRef,
} from '@angular/core';

/** Mouse event payload with coordinates and modifier keys. */
export interface MouseEventPayload {
  clientX: number;
  clientY: number;
  offsetX: number;
  offsetY: number;
  button: number;
  buttons: number;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

@Directive({
  selector: '[appMouseEvents]',
  standalone: true,
})
export class MouseEventsDirective {
  mouseDown: OutputEmitterRef<MouseEventPayload> = output<MouseEventPayload>();
  mouseUp: OutputEmitterRef<MouseEventPayload> = output<MouseEventPayload>();
  mouseEnter: OutputEmitterRef<MouseEventPayload> = output<MouseEventPayload>();
  mouseLeave: OutputEmitterRef<MouseEventPayload> = output<MouseEventPayload>();
  mouseMove: OutputEmitterRef<MouseEventPayload> = output<MouseEventPayload>();
  clicked: OutputEmitterRef<MouseEventPayload> = output<MouseEventPayload>();
  dblClicked: OutputEmitterRef<MouseEventPayload> = output<MouseEventPayload>();
  contextMenuSelect: OutputEmitterRef<MouseEventPayload> =
    output<MouseEventPayload>();

  private toPayload(e: MouseEvent): MouseEventPayload {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    return {
      clientX: e.clientX,
      clientY: e.clientY,
      offsetX: e.offsetX ?? e.clientX - rect.left,
      offsetY: e.offsetY ?? e.clientY - rect.top,
      button: e.button,
      buttons: e.buttons,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
    };
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(e: MouseEvent): void {
    this.mouseDown.emit(this.toPayload(e));
  }

  @HostListener('mouseup', ['$event'])
  onMouseUp(e: MouseEvent): void {
    this.mouseUp.emit(this.toPayload(e));
  }

  @HostListener('mouseenter', ['$event'])
  onMouseEnter(e: MouseEvent): void {
    this.mouseEnter.emit(this.toPayload(e));
  }

  @HostListener('mouseleave', ['$event'])
  onMouseLeave(e: MouseEvent): void {
    this.mouseLeave.emit(this.toPayload(e));
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    this.mouseMove.emit(this.toPayload(e));
  }

  @HostListener('click', ['$event'])
  onClick(e: MouseEvent): void {
    this.clicked.emit(this.toPayload(e));
  }

  @HostListener('dblclick', ['$event'])
  onDblClick(e: MouseEvent): void {
    this.dblClicked.emit(this.toPayload(e));
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(e: Event): void {
    this.contextMenuSelect.emit(this.toPayload(e as MouseEvent));
  }
}
