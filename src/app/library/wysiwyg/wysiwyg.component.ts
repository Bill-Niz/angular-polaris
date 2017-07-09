/**
 * Code for this class was copied and adapted from the
 * (NGX-Quill component)[https://github.com/KillerCodeMonkey/ngx-quill/blob/develop/src/quill-editor.component.ts].
 *
 * Original copyright go to Bengt Weiße (aka: KillerCodeMonkey). The original code was distributed under an MIT licence.
 *
 */

import {
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    forwardRef,
    Input,
    OnChanges,
    Output,
    SimpleChanges,
    ViewEncapsulation
} from '@angular/core';

import {
    NG_VALUE_ACCESSOR,
    NG_VALIDATORS,
    ControlValueAccessor,
    Validator
} from '@angular/forms';

import * as Quill from 'quill';
import { AngularComplexAction } from '../types';
import { createUniqueIDFactory } from '@shopify/javascript-utilities/other';


const getUniqueID = createUniqueIDFactory('Wysiwyg');

/**
 * Componenent for rendering a WYSIWYG
 */
@Component({
    selector: 'plrsWysiwyg',
    templateUrl: 'wysiwyg.component.html',
    styleUrls: ['./wysiwyg.component.css'],
    providers: [{
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => WysiwygComponent),
        multi: true
    }, {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => WysiwygComponent),
            multi: true
        }],
    host: {
        '[class.focus]': 'focus',
    },

})
export class WysiwygComponent implements AfterViewInit, ControlValueAccessor, OnChanges, Validator {

    quillEditor: any;
    editorElem: HTMLElement;
    emptyArray: any[] = [];
    content: any;
    defaultModules = {
        toolbar: [
            ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
            ['blockquote', 'code-block'],

            [{ 'header': 1 }, { 'header': 2 }],               // custom button values
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'script': 'sub' }, { 'script': 'super' }],      // superscript/subscript
            [{ 'indent': '-1' }, { 'indent': '+1' }],          // outdent/indent
            [{ 'direction': 'rtl' }],                         // text direction

            [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],

            [{ 'color': this.emptyArray.slice() }, { 'background': this.emptyArray.slice() }],          // dropdown with defaults from theme
            [{ 'font': this.emptyArray.slice() }],
            [{ 'align': this.emptyArray.slice() }],

            ['clean'],                                         // remove formatting button

            ['link', 'image', 'video']                         // link and image, video
        ]
    };

    @Input() id = getUniqueID();
    @Input() helpText: string;
    @Input() theme: string;
    @Input() modules: { [index: string]: Object };
    @Input() readOnly: boolean;
    @Input() placeholder: string;
    @Input() maxLength: number;
    @Input() minLength: number;
    @Input() required: boolean;
    @Input() formats: string[];
    @Input() bounds: HTMLElement | string;
    @Input() label: string;
    @Input() labelAction: AngularComplexAction;
    @Input() labelHidden: boolean;
    @Input()
    get toolbarOpts(): any[] {
        return this.defaultModules.toolbar;
    }
    set toolbarOpts(value: any[]) {
        this.defaultModules.toolbar = value;
    }

    @Output() onEditorCreated: EventEmitter<any> = new EventEmitter();
    @Output() onContentChanged: EventEmitter<any> = new EventEmitter();
    @Output() onSelectionChanged: EventEmitter<any> = new EventEmitter();

    onModelChange: Function = () => { };
    onModelTouched: Function = () => { };

    constructor(private elementRef: ElementRef) { }

    ngAfterViewInit() {
        const toolbarElem = this.elementRef.nativeElement.querySelector('[quill-editor-toolbar]');
        let modules: any = this.modules || this.defaultModules;
        let placeholder = 'Insert text here ...';

        if (this.placeholder !== null && this.placeholder !== undefined) {
            placeholder = this.placeholder.trim();
        }

        if (toolbarElem) {
            modules['toolbar'] = toolbarElem;
        }
        this.elementRef.nativeElement.insertAdjacentHTML('beforeend', '<div quill-editor-element></div>');
        this.editorElem = this.elementRef.nativeElement.querySelector('[quill-editor-element]');

        this.quillEditor = new Quill(this.editorElem, {
            modules: modules,
            placeholder: placeholder,
            readOnly: this.readOnly || false,
            theme: this.theme || 'snow',
            formats: this.formats
        });

        if (this.content) {
            const contents = this.quillEditor.clipboard.convert(this.content);
            this.quillEditor.setContents(contents);
            this.quillEditor.history.clear();
        }

        this.onEditorCreated.emit(this.quillEditor);

        // mark model as touched if editor lost focus
        this.quillEditor.on('selection-change', (range: any, oldRange: any, source: string) => {
            this.onSelectionChanged.emit({
                editor: this.quillEditor,
                range: range,
                oldRange: oldRange,
                source: source,
                bounds: this.bounds || document.body
            });

            if (!range) {
                this.onModelTouched();
            }
        });

        // update model if text changes
        this.quillEditor.on('text-change', (delta: any, oldDelta: any, source: string) => {
            let html: (string | null) = this.editorElem.children[0].innerHTML;
            const text = this.quillEditor.getText();

            if (html === '<p><br></p>') {
                html = null;
            }

            this.onModelChange(html);

            this.onContentChanged.emit({
                editor: this.quillEditor,
                html: html,
                text: text,
                delta: delta,
                oldDelta: oldDelta,
                source: source
            });
        });
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['readOnly'] && this.quillEditor) {
            this.quillEditor.enable(!changes['readOnly'].currentValue);
        }
    }

    writeValue(currentValue: any) {
        this.content = currentValue;

        if (this.quillEditor) {
            if (currentValue) {
                this.quillEditor.pasteHTML(currentValue);
                return;
            }
            this.quillEditor.setText('');
        }
    }

    registerOnChange(fn: Function): void {
        this.onModelChange = fn;
    }

    registerOnTouched(fn: Function): void {
        this.onModelTouched = fn;
    }

    validate() {
        if (!this.quillEditor) {
            return null;
        }

        let err: {
            minLengthError?: { given: number, minLength: number };
            maxLengthError?: { given: number, maxLength: number };
            requiredError?: { empty: boolean }
        } = {},
            valid = true;

        const textLength = this.quillEditor.getText().trim().length;

        if (this.minLength && textLength && textLength < this.minLength) {
            err.minLengthError = {
                given: textLength,
                minLength: this.minLength
            };

            valid = false;
        }

        if (this.maxLength && textLength > this.maxLength) {
            err.maxLengthError = {
                given: textLength,
                maxLength: this.maxLength
            };

            valid = false;
        }

        if (this.required && !textLength) {
            err.requiredError = {
                empty: true
            };

            valid = false;
        }

        return valid ? null : err;
    }

        public get focus(): boolean {
        return this.quillEditor !== undefined &&
            typeof this.quillEditor.hasFocus === 'function' &&
            this.quillEditor.hasFocus();
    }

        public focusEditor() {
        if (this.quillEditor !== undefined) {
            this.quillEditor.focus();
        }
    }

}
