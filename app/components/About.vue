<script setup lang="ts">
import { APP_NAME, GITHUB, PROGRAM_MODIFIED, SOURCE_REPOSITORY } from '@/core/config/env.ts'
import { withAppBaseURL } from '@/core/utils/base-url'
import ChannelIcons from '@/components/channel-icons/ChannelIcons.vue'
import WeChat from '@/components/channel-icons/WeChat.vue'

const licenseUrl = withAppBaseURL('/LICENSE.txt')
const noticeUrl = withAppBaseURL('/NOTICE.txt')
const dataNoticeUrl = withAppBaseURL('/DATA-NOTICES.txt')
</script>

<template>
  <h1>{{ APP_NAME }}</h1>
  <div class="w-120">
    <p class="text-xl">
      {{ $t('about_thanks') }}
    </p>
    <p>
      {{ $t('github_address') }}<a :href="GITHUB" target="_blank">{{ GITHUB }}</a>
    </p>
    <div class="flex flex-col gap-2 mt-6 text-sm leading-6">
      <p>
        本页面是 TypeWords 的修改版本（{{ PROGRAM_MODIFIED }}），用于敢说英语的独立路径 /typewords/。程序按 GNU
        General Public License v3.0 提供，没有任何担保。
      </p>
      <p>
        上游项目：<a :href="GITHUB" target="_blank">{{ GITHUB }}</a>
      </p>
      <p>
        本修改版对应源代码：<a :href="SOURCE_REPOSITORY" target="_blank">{{ SOURCE_REPOSITORY }}</a>
      </p>
      <p>
        <a :href="licenseUrl">许可证全文</a>
        ·
        <a :href="noticeUrl">修改说明</a>
        ·
        <a :href="dataNoticeUrl">第三方数据说明</a>
      </p>
    </div>
    <div class="flex flex-col gap-2 mt-20">
      <div class="">常见问题： <RouterLink to="/help">常见问题解答</RouterLink></div>
      <div class="flex items-center">{{ $t('about_wechat_feedback') }}<WeChat /></div>
      <div class="">
        {{ $t('about_ticket_feedback')
        }}<a :href="`https://v.wjx.cn/vm/ev0W7fv.aspx#`" target="_blank">https://v.wjx.cn/vm/ev0W7fv.aspx#</a>
      </div>
      <div class="flex items-center">
        {{ $t('about_other_channels') }}
        <ChannelIcons type="horizontal" :share="false" :wechat="false" :github="false" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
