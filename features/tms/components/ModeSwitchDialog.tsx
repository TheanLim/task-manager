import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { tmsCopy } from '../copy/tms-copy';

interface ModeSwitchDialogProps {
  open: boolean;
  fromMode: string;
  toMode: string;
  fvpProgress?: number;
  fvpTotal?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ModeSwitchDialog({
  open,
  fromMode,
  toMode,
  fvpProgress,
  fvpTotal,
  onConfirm,
  onCancel,
}: ModeSwitchDialogProps) {
  const body =
    fromMode.toLowerCase() === 'fvp' &&
    fvpProgress !== undefined &&
    fvpTotal !== undefined
      ? tmsCopy.confirmDialog.fvpBody(fvpProgress, fvpTotal)
      : toMode.toLowerCase() === 'fvp'
        ? tmsCopy.confirmDialog.toFvpBody(fromMode)
        : tmsCopy.confirmDialog.genericBody(fromMode);

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{tmsCopy.confirmDialog.title(toMode)}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* autoFocus ensures focus lands on Cancel when dialog opens */}
          <AlertDialogCancel autoFocus>
            {tmsCopy.confirmDialog.cancelButton}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {tmsCopy.confirmDialog.confirmButton(toMode)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
