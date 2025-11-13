import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { DialogTrigger } from '@radix-ui/react-dialog'
import { useForm } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

interface EditNameModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditNameModal({ open, onOpenChange }: EditNameModalProps) {
  // Get current user
  const { data: user } = useQuery(convexQuery(api.users.getCurrentUser, {}))

  // Update display name mutation
  const updateDisplayName = useConvexMutation(api.users.updateDisplayName)

  // Create form
  const form = useForm({
    defaultValues: {
      displayName: '',
    },
    onSubmit: async ({ value }) => {
      try {
        await updateDisplayName({ displayName: value.displayName })
        onOpenChange(false)
      } catch (error) {
        console.error('Failed to update display name:', error)
      }
    },
  })

  // Update form when user data loads
  useEffect(() => {
    if (user?.displayName) {
      form.setFieldValue('displayName', user.displayName)
    } else if (user?.name) {
      form.setFieldValue('displayName', user.name)
    }
  }, [user, form])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change name</DialogTitle>
          <DialogDescription>
            This name will appear next to your cursor when collaborating with others.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          <div className="space-y-4 py-4">
            <form.Field name="displayName">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-muted-foreground">
                    Display Name
                  </Label>
                  <Input
                    id="displayName"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Enter your name"
                    maxLength={50}
                    className="text-foreground"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </form.Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
