import { StackHandler } from '@stackframe/stack'
import { stackServerApp } from '../../../../stack'
import StackLayout from './StackLayout'

export default function Handler(props: unknown) {
  return (
    <StackLayout>
      <StackHandler app={stackServerApp} routeProps={props} />
    </StackLayout>
  )
}
