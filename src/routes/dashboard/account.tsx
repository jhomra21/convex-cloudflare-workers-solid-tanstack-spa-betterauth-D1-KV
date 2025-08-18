import { createFileRoute } from '@tanstack/solid-router';
import { createSignal, createMemo, Show, createEffect } from 'solid-js';
import { useQuery } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '~/components/ui/avatar';
import { Separator } from '~/components/ui/separator';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from '~/components/ui/dialog';
import { sessionQueryOptions } from '~/lib/auth-guard';
import { useUpdateUserMutation, useDeleteUserMutation } from '~/lib/auth-actions';

function getInitials(name: string) {
	if (!name || name === 'Guest') return name.charAt(0).toUpperCase() || 'G';
	return (
		name
			.split(' ')
			.map((part) => part[0]?.toUpperCase() || '')
			.join('')
			.slice(0, 2) || 'U'
	);
}

function AccountPage() {
	const sessionQuery = useQuery(() => sessionQueryOptions());
	const user = createMemo(() => sessionQuery.data?.user);
	const [name, setName] = createSignal('');

	createEffect(() => {
		if (user()?.name) {
			setName(user()!.name!);
		}
	});

	
	// Account deletion state
	const [showDeleteDialog, setShowDeleteDialog] = createSignal(false);
	const [deletePassword, setDeletePassword] = createSignal('');
	const [deleteConfirmation, setDeleteConfirmation] = createSignal('');

	const updateUserMutation = useUpdateUserMutation();
	const deleteUserMutation = useDeleteUserMutation();

	const handleSave = (e: Event) => {
		e.preventDefault();
		if (name() === user()?.name) {
			toast.info('No changes made.');
			return;
		}

		const promise = updateUserMutation.mutateAsync({
			name: name(),
			image: user()?.image
		});

		toast.promise(promise, {
			loading: 'Saving changes...',
			success: 'Account updated successfully!',
			error: (err) => `Failed to update: ${err.message}`
		});
	};

	const handleDeleteAccount = () => {
		if (deleteConfirmation() !== 'DELETE') {
			toast.error('Please type DELETE to confirm');
			return;
		}

		const promise = deleteUserMutation.mutateAsync(deletePassword() || undefined);

		toast.promise(promise, {
			loading: 'Deleting account...',
			success: 'Account deleted successfully',
			error: (err) => `Failed to delete account: ${err.message}`
		});

		setShowDeleteDialog(false);
	};

	return (
		<div class="container p-2 !pt-0 space-y-8">
			<div>
				<h1 class="text-3xl font-bold tracking-tight">Account Settings</h1>
				<p class="text-muted-foreground mt-1">Manage your account, preferences, and data.</p>
			</div>

			{/* Profile Information */}
			<Card class="overflow-hidden">
				<CardHeader>
					<CardTitle>Profile Information</CardTitle>
				</CardHeader>
				<form onSubmit={handleSave} autocomplete="off">
					<CardContent class="p-0">
						<div class="flex items-center justify-between p-6">
							<div>
								<h3 class="text-base font-medium">Your Name</h3>
								<p class="text-sm text-muted-foreground">This will be displayed on your profile.</p>
							</div>
							<Input
								id="name"
								name="name"
								class="max-w-xs"
								value={name()}
								onChange={setName}
								placeholder="Your name"
							/>
						</div>

						<Separator />

						<div class="flex items-center justify-between p-6">
							<div>
								<h3 class="text-base font-medium">Email Address</h3>
								<p class="text-sm text-muted-foreground">Your email address cannot be changed.</p>
							</div>
							<Input
								id="email"
								name="email"
								class="max-w-xs"
								value={user()?.email || ''}
								disabled
								placeholder="Your email"
							/>
						</div>

						<Separator />

						<div class="flex items-center justify-between p-6">
							<div>
								<h3 class="text-base font-medium">Avatar</h3>
								<p class="text-sm text-muted-foreground">This is your profile picture.</p>
							</div>
							<div class="flex items-center gap-4">
								<Avatar class="h-12 w-12">
									<Show
										when={user()?.image}
										fallback={<AvatarFallback class="text-xl">{getInitials(user()?.name || '')}</AvatarFallback>}
									>
										<AvatarImage src={user()?.image!} alt={user()?.name || ''} />
									</Show>
								</Avatar>
								<Button variant="outline" size="sm" disabled class="opacity-60 cursor-not-allowed">
									Change (soon)
								</Button>
							</div>
						</div>
					</CardContent>
					<CardFooter class="flex items-center justify-between bg-muted/50">
						<p class="text-sm text-muted-foreground">
							Joined on{' '}
							{user()?.createdAt
								? new Date(user()!.createdAt).toLocaleDateString(undefined, {
									month: 'long',
									day: 'numeric',
									year: 'numeric'
								})
								: '—'}
						</p>
						<Button
							type="submit"
							variant="sf-compute"
							disabled={updateUserMutation.isPending || name() === user()?.name}
						>
							{updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
						</Button>
					</CardFooter>
				</form>
			</Card>

			{/* Danger Zone */}
			<Card class="border-destructive/20">
				<CardHeader>
					<CardTitle class="text-destructive">Danger Zone</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="flex items-center justify-between p-4 rounded-lg bg-destructive/5">
						<div>
							<h3 class="text-base font-medium text-destructive">Delete Account</h3>
							<p class="text-sm text-muted-foreground">
								Permanently delete your account and all associated data. This action cannot be undone.
							</p>
						</div>
						<Dialog open={showDeleteDialog()} onOpenChange={setShowDeleteDialog}>
							<DialogTrigger as={Button} variant="sf-compute-destructive" size="sm">
								Delete Account
							</DialogTrigger>
							<DialogContent class="sm:max-w-md">
								<DialogHeader>
									<DialogTitle class="text-destructive">Delete Account</DialogTitle>
									<DialogDescription>
										This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
									</DialogDescription>
								</DialogHeader>
								<div class="space-y-4">
									<Show when={user()?.email?.includes('@')}>
										<div>
											<label for="delete-password" class="text-sm font-medium">
												Password
											</label>
											<Input
												id="delete-password"
												type="password"
												placeholder="Enter your password"
												value={deletePassword()}
												onChange={setDeletePassword}
											/>
										</div>
									</Show>
									<div>
										<label for="delete-confirmation" class="text-sm font-medium">
											Type <span class="font-mono bg-muted px-1 rounded">DELETE</span> to confirm
										</label>
										<Input
											id="delete-confirmation"
											placeholder="DELETE"
											value={deleteConfirmation()}
											onChange={setDeleteConfirmation}
										/>
									</div>
									<div class="flex gap-2 pt-4">
										<Button
											variant="outline"
											class="flex-1"
											onClick={() => setShowDeleteDialog(false)}
										>
											Cancel
										</Button>
										<Button
											variant="sf-compute-destructive"
											class="flex-1"
											disabled={
												deleteConfirmation() !== 'DELETE' ||
												deleteUserMutation.isPending
											}
											onClick={handleDeleteAccount}
										>
											{deleteUserMutation.isPending ? 'Deleting...' : 'Delete Account'}
										</Button>
									</div>
								</div>
							</DialogContent>
						</Dialog>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export const Route = createFileRoute('/dashboard/account')({
	component: AccountPage
});
