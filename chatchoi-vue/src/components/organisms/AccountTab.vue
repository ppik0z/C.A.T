<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import PasswordField from "@/components/atoms/PasswordField.vue";
import PreferenceRow from "@/components/molecules/PreferenceRow.vue";
import { useAccountStore } from "@/stores/account";
import { resolveDisplayName, formatUsername } from "@/utils/userPresentation";
import ProfileCardContent from "@/components/molecules/ProfileCardContent.vue";
import AccountTabSkeleton from "@/components/molecules/AccountTabSkeleton.vue";
import { useAuthStore } from "@/stores/auth";
import { requestEmailVerification } from "@/services/auth.service";

const accountStore = useAccountStore();
const authStore = useAuthStore();

const isEditing = ref(false);
const draftProfile = ref({
  displayName: "",
  bio: "",
  customStatus: "",
});
const fileInput = ref<HTMLInputElement | null>(null);
const isUploading = ref(false);
const isSendingVerification = ref(false);
const isEditingEmail = ref(false);
const emailDraft = ref("");
const emailError = ref<string | null>(null);
const isChangingPassword = ref(false);
const passwordForm = ref({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});
const passwordError = ref<string | null>(null);
const verificationFeedback = ref<{
  type: "success" | "error";
  message: string;
} | null>(null);

const displayName = computed(() => resolveDisplayName(accountStore.me));
const BCRYPT_MAX_PASSWORD_BYTES = 72;
const getUtf8ByteLength = (value: string) => new TextEncoder().encode(value).length;

onMounted(async () => {
  await accountStore.fetchAccount();
  syncDrafts();
});

const syncDrafts = () => {
  draftProfile.value = {
    displayName: accountStore.me?.displayName || "",
    bio: accountStore.me?.bio || "",
    customStatus: accountStore.me?.customStatus || "",
  };
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  isUploading.value = true;
  try {
    await accountStore.updateAvatar(file);
    // Tạm thời lấy lại chatStore info nếu cần, API updateAvatar nên refresh auth
  } catch (err) {
    console.error(err);
  } finally {
    isUploading.value = false;
  }
};

const handleSave = async () => {
  try {
    await accountStore.updateProfile(draftProfile.value);
    isEditing.value = false;
  } catch (error) {
    console.error("Failed to save profile", error);
  }
};

const sendVerificationEmail = async () => {
  isSendingVerification.value = true;
  verificationFeedback.value = null;
  try {
    const result = await requestEmailVerification();
    verificationFeedback.value = {
      type: "success",
      message: result.message,
    };
  } catch (caught) {
    verificationFeedback.value = {
      type: "error",
      message:
        caught instanceof Error
          ? caught.message
          : "Không thể gửi email xác minh.",
    };
  } finally {
    isSendingVerification.value = false;
  }
};

const openEmailForm = () => {
  emailDraft.value = accountStore.me?.email ?? "";
  emailError.value = null;
  verificationFeedback.value = null;
  isEditingEmail.value = true;
};

const closeEmailForm = () => {
  emailDraft.value = accountStore.me?.email ?? "";
  emailError.value = null;
  isEditingEmail.value = false;
};

const handleUpdateEmail = async () => {
  const normalizedEmail = emailDraft.value.trim().toLowerCase();
  emailError.value = null;
  verificationFeedback.value = null;

  if (!normalizedEmail) {
    emailError.value = "Vui lòng nhập địa chỉ email.";
    return;
  }
  if (normalizedEmail === accountStore.me?.email?.toLowerCase()) {
    emailError.value = "Email mới không thay đổi.";
    return;
  }

  try {
    const account = await accountStore.updateProfile({ email: normalizedEmail });
    emailDraft.value = account.email ?? normalizedEmail;
    isEditingEmail.value = false;

    try {
      await requestEmailVerification();
      verificationFeedback.value = {
        type: "success",
        message: `Đã cập nhật email thành ${emailDraft.value}. Hãy kiểm tra hộp thư để xác minh.`,
      };
    } catch (caught) {
      verificationFeedback.value = {
        type: "error",
        message:
          caught instanceof Error
            ? `Email đã được cập nhật nhưng chưa thể gửi thư xác minh: ${caught.message}`
            : "Email đã được cập nhật nhưng chưa thể gửi thư xác minh.",
      };
    }
  } catch (caught) {
    emailError.value =
      caught instanceof Error ? caught.message : "Không thể cập nhật email.";
  }
};

const resetPasswordForm = () => {
  passwordForm.value = {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  };
  passwordError.value = null;
};

const closePasswordForm = () => {
  isChangingPassword.value = false;
  resetPasswordForm();
};

const togglePasswordForm = () => {
  if (isChangingPassword.value) {
    closePasswordForm();
    return;
  }
  isChangingPassword.value = true;
  passwordError.value = null;
};

const getPasswordValidationError = () => {
  const { currentPassword, newPassword, confirmPassword } = passwordForm.value;
  if (currentPassword.length < 8 || newPassword.length < 8) {
    return "Mật khẩu phải có ít nhất 8 ký tự.";
  }
  if (
    getUtf8ByteLength(currentPassword) > BCRYPT_MAX_PASSWORD_BYTES ||
    getUtf8ByteLength(newPassword) > BCRYPT_MAX_PASSWORD_BYTES
  ) {
    return "Mật khẩu không được vượt quá 72 byte.";
  }
  if (newPassword !== confirmPassword) {
    return "Mật khẩu xác nhận không khớp.";
  }
  if (newPassword === currentPassword) {
    return "Mật khẩu mới phải khác mật khẩu hiện tại.";
  }
  return null;
};

const handleChangePassword = async () => {
  passwordError.value = getPasswordValidationError();
  if (passwordError.value) return;

  try {
    await accountStore.changePassword({
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword,
    });
    resetPasswordForm();
    await authStore.logout();
  } catch (caught) {
    passwordError.value =
      caught instanceof Error ? caught.message : "Không thể đổi mật khẩu.";
  }
};
</script>

<template>
  <AccountTabSkeleton v-if="accountStore.isLoading && !accountStore.me" />
  <div v-else class="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
    <!-- Profile Preview Card -->
    <Card>
      <CardContent class="overflow-hidden p-0">
        <ProfileCardContent
          :avatar-url="accountStore.me?.avatar"
          :banner="accountStore.me?.banner"
          :bio="isEditing ? draftProfile.bio : accountStore.me?.bio"
          :custom-status="
            isEditing
              ? draftProfile.customStatus
              : accountStore.me?.customStatus
          "
          eyebrow="Giới thiệu"
          :is-online="accountStore.me?.presence === 'online'"
          :name="
            isEditing
              ? draftProfile.displayName || accountStore.me?.username || 'User'
              : displayName
          "
          :status-label="
            accountStore.me?.presence === 'online' ? 'Online' : 'Offline'
          "
          :username="formatUsername(accountStore.me?.username)"
        />
        <div class="px-4 pb-4">
          <button
            class="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-container/30"
            type="button"
            @click="triggerFileInput"
          >
            {{ isUploading ? "Đang tải ảnh..." : "Đổi ảnh đại diện" }}
          </button>
          <input
            ref="fileInput"
            class="hidden"
            type="file"
            accept="image/*"
            @change="handleFileChange"
          />
        </div>
      </CardContent>
    </Card>

    <!-- Settings Card -->
    <Card>
      <CardHeader class="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{{ $t("settings.account.title") }}</CardTitle>
          <CardDescription>{{
            $t("settings.account.description")
          }}</CardDescription>
        </div>
        <Button v-if="!isEditing" @click="isEditing = true" variant="outline"
          >Chỉnh sửa hồ sơ</Button
        >
      </CardHeader>
      <CardContent>
        <template v-if="!isEditing">
          <PreferenceRow
            icon="person"
            :title="$t('settings.account.displayName.title')"
            :description="$t('settings.account.displayName.description')"
          >
            <span class="font-semibold text-on-surface">{{ displayName }}</span>
          </PreferenceRow>
          <Separator />
          <PreferenceRow
            icon="info"
            title="Giới thiệu bản thân"
            description="Một đoạn ngắn mô tả về bạn."
          >
            <span
              class="font-semibold text-on-surface line-clamp-2 max-w-[200px] text-right"
              >{{ accountStore.me?.bio || "Chưa cập nhật" }}</span
            >
          </PreferenceRow>
          <Separator />
          <PreferenceRow
            icon="mail"
            title="Email"
            :description="
              accountStore.me?.email
                ? accountStore.me.isEmailVerified
                  ? 'Đã xác minh'
                  : 'Chưa xác minh'
                : 'Chưa thêm email'
            "
          >
            <div class="flex max-w-[240px] flex-col items-end gap-2 text-right">
              <p
                class="max-w-[220px] truncate text-sm font-semibold text-on-surface"
              >
                {{ accountStore.me?.email || "Chưa cập nhật" }}
              </p>
              <div class="flex flex-wrap justify-end gap-2">
                <Button
                  v-if="
                    accountStore.me?.email && !accountStore.me.isEmailVerified
                  "
                  :disabled="isSendingVerification || accountStore.isSaving"
                  size="sm"
                  type="button"
                  variant="ghost"
                  @click="sendVerificationEmail"
                >
                  {{
                    isSendingVerification
                      ? "Đang gửi..."
                      : "Gửi lại xác minh"
                  }}
                </Button>
                <Button
                  :disabled="accountStore.isSaving"
                  size="sm"
                  type="button"
                  variant="outline"
                  @click="isEditingEmail ? closeEmailForm() : openEmailForm()"
                >
                  {{
                    isEditingEmail
                      ? "Đóng"
                      : accountStore.me?.email
                        ? "Chỉnh sửa"
                        : "Thêm email"
                  }}
                </Button>
              </div>
            </div>
          </PreferenceRow>
          <form
            v-if="isEditingEmail"
            class="mb-4 rounded-xl border border-outline-variant bg-surface-container-low p-4"
            @submit.prevent="handleUpdateEmail"
          >
            <label
              class="mb-1.5 block text-sm font-bold text-on-surface"
              for="account-email"
            >
              {{ accountStore.me?.email ? "Email mới" : "Địa chỉ email" }}
            </label>
            <input
              id="account-email"
              v-model="emailDraft"
              autocomplete="email"
              class="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="accountStore.isSaving"
              maxlength="255"
              placeholder="tenban@example.com"
              required
              type="email"
            />
            <p class="mt-2 text-xs font-semibold leading-5 text-on-surface-variant">
              Email mới cần được xác minh trước khi dùng để khôi phục mật khẩu.
            </p>
            <p
              v-if="emailError"
              class="mt-3 rounded-lg bg-error-container px-3 py-2 text-sm font-semibold text-error"
              role="alert"
            >
              {{ emailError }}
            </p>
            <div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                :disabled="accountStore.isSaving"
                type="button"
                variant="ghost"
                @click="closeEmailForm"
              >
                Hủy
              </Button>
              <Button :disabled="accountStore.isSaving" type="submit">
                {{
                  accountStore.isSaving
                    ? "Đang lưu email..."
                    : accountStore.me?.email
                      ? "Cập nhật email"
                      : "Thêm email"
                }}
              </Button>
            </div>
          </form>
          <p
            v-if="verificationFeedback"
            :class="[
              'mb-3 rounded-lg px-3 py-2 text-sm font-semibold',
              verificationFeedback.type === 'error'
                ? 'bg-error-container text-error'
                : 'bg-primary-container text-on-primary-container',
            ]"
            aria-live="polite"
            :role="verificationFeedback.type === 'error' ? 'alert' : 'status'"
          >
            {{ verificationFeedback.message }}
          </p>
          <Separator />
          <PreferenceRow
            icon="lock"
            :title="$t('settings.account.password.title')"
            :description="$t('settings.account.password.description')"
          >
            <Button
              type="button"
              variant="outline"
              @click="togglePasswordForm"
            >
              {{
                isChangingPassword
                  ? "Đóng"
                  : $t("settings.account.password.action")
              }}
            </Button>
          </PreferenceRow>
          <form
            v-if="isChangingPassword"
            class="mb-4 rounded-xl border border-outline-variant bg-surface-container-low p-4"
            @submit.prevent="handleChangePassword"
          >
            <div class="grid gap-4">
              <PasswordField
                id="current-password"
                v-model="passwordForm.currentPassword"
                autocomplete="current-password"
                :disabled="accountStore.isChangingPassword"
                label="Mật khẩu hiện tại"
              />
              <PasswordField
                id="new-account-password"
                v-model="passwordForm.newPassword"
                autocomplete="new-password"
                :disabled="accountStore.isChangingPassword"
                label="Mật khẩu mới"
              />
              <PasswordField
                id="confirm-account-password"
                v-model="passwordForm.confirmPassword"
                autocomplete="new-password"
                :disabled="accountStore.isChangingPassword"
                label="Xác nhận mật khẩu mới"
              />
            </div>

            <p class="mt-3 text-xs font-semibold leading-5 text-on-surface-variant">
              Mật khẩu cần ít nhất 8 ký tự. Sau khi đổi thành công, bạn sẽ được đăng xuất khỏi tất cả thiết bị.
            </p>
            <p
              v-if="passwordError"
              class="mt-3 rounded-lg bg-error-container px-3 py-2 text-sm font-semibold text-error"
              role="alert"
            >
              {{ passwordError }}
            </p>

            <div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                :disabled="accountStore.isChangingPassword"
                type="button"
                variant="ghost"
                @click="closePasswordForm"
              >
                Hủy
              </Button>
              <Button
                :disabled="accountStore.isChangingPassword"
                type="submit"
              >
                {{
                  accountStore.isChangingPassword
                    ? "Đang đổi mật khẩu..."
                    : "Đổi mật khẩu"
                }}
              </Button>
            </div>
          </form>
          <Separator />
          <PreferenceRow
            icon="logout"
            :title="$t('settings.account.logout.title')"
            :description="$t('settings.account.logout.description')"
          >
            <Button
              type="button"
              variant="destructive"
              @click="authStore.logout()"
              >{{ $t("settings.account.logout.action") }}</Button
            >
          </PreferenceRow>
        </template>

        <template v-else>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-bold text-on-surface mb-1"
                >Tên hiển thị</label
              >
              <input
                v-model="draftProfile.displayName"
                class="w-full h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm focus:ring-2 focus:ring-primary"
                placeholder="Tên hiển thị..."
              />
            </div>
            <div>
              <label class="block text-sm font-bold text-on-surface mb-1"
                >Trạng thái tuỳ chỉnh</label
              >
              <input
                v-model="draftProfile.customStatus"
                class="w-full h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm focus:ring-2 focus:ring-primary"
                placeholder="Đang code..."
              />
            </div>
            <div>
              <label class="block text-sm font-bold text-on-surface mb-1"
                >Giới thiệu bản thân</label
              >
              <textarea
                v-model="draftProfile.bio"
                class="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm focus:ring-2 focus:ring-primary"
                rows="3"
                placeholder="Đôi nét về bạn..."
              ></textarea>
            </div>
            <div class="flex justify-end gap-2 pt-4">
              <Button
                variant="ghost"
                @click="
                  isEditing = false;
                  syncDrafts();
                "
                >Hủy</Button
              >
              <Button :disabled="accountStore.isSaving" @click="handleSave">{{
                accountStore.isSaving ? "Đang lưu..." : "Lưu thay đổi"
              }}</Button>
            </div>
          </div>
        </template>
        <p
          v-if="accountStore.error"
          class="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm font-semibold text-error"
        >
          {{ accountStore.error }}
        </p>
      </CardContent>
    </Card>
  </div>
</template>
