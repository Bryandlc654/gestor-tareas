import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Unlink } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#2383E2] hover:underline cursor-pointer',
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'rich-text-content focus:outline-none max-w-none min-h-[120px] px-4 py-3 bg-white border border-gray-200 rounded-b-xl',
      },
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      // Small check to avoid losing cursor position
      // only update if really different (e.g. from props reset)
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    // cancelled
    if (url === null) {
      return;
    }

    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    // update link
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-col w-full shadow-sm">
      <div className="flex items-center gap-1 bg-gray-50 border border-b-0 border-gray-200 rounded-t-xl px-2 py-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded-md hover:bg-gray-200 transition-colors ${editor.isActive('bold') ? 'bg-gray-200 text-black' : 'text-gray-600'}`}
          title="Negrita"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded-md hover:bg-gray-200 transition-colors ${editor.isActive('italic') ? 'bg-gray-200 text-black' : 'text-gray-600'}`}
          title="Cursiva"
        >
          <Italic className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded-md hover:bg-gray-200 transition-colors ${editor.isActive('bulletList') ? 'bg-gray-200 text-black' : 'text-gray-600'}`}
          title="Lista"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded-md hover:bg-gray-200 transition-colors ${editor.isActive('orderedList') ? 'bg-gray-200 text-black' : 'text-gray-600'}`}
          title="Lista Enumerada"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={setLink}
          className={`p-1.5 rounded-md hover:bg-gray-200 transition-colors ${editor.isActive('link') ? 'bg-gray-200 text-black' : 'text-gray-600'}`}
          title="Añadir Enlace"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        {editor.isActive('link') && (
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            className="p-1.5 rounded-md hover:bg-gray-200 transition-colors text-gray-600"
            title="Quitar Enlace"
          >
            <Unlink className="w-4 h-4" />
          </button>
        )}
      </div>
      <EditorContent editor={editor} />
      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: '${placeholder || 'Escribe aquí...'}';
          float: left;
          height: 0;
          pointer-events: none;
        }
        .ProseMirror ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .ProseMirror ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .ProseMirror p {
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
}
