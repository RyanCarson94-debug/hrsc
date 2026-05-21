import ReactMarkdown from 'react-markdown'

export function MarkdownContent({ children, className = '' }) {
  return (
    <div className={`prose-playbook ${className}`}>
      <ReactMarkdown>{children || ''}</ReactMarkdown>
    </div>
  )
}
