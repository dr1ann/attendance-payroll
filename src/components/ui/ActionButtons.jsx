import Button from './Button'
import Icon from './Icon'

export default function ActionButtons({ onEdit, onDelete, deleteLabel = 'Delete', disabled = false }) {
  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={onEdit} disabled={disabled} icon={<Icon name="edit" />}>
        Edit
      </Button>
      <Button variant="danger" onClick={onDelete} disabled={disabled} icon={<Icon name="delete" />}>
        {deleteLabel}
      </Button>
    </div>
  )
}
