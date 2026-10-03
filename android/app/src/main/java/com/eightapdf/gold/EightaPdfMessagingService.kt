package com.eightapdf.gold
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
class EightaPdfMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) { getSharedPreferences("fcm", MODE_PRIVATE).edit().putString("token", token).apply() }
    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val type = data["type"].orEmpty()
        val title = message.notification?.title ?: data["title"] ?: "8aPDF update"
        val body = message.notification?.body ?: data["body"] ?: "A new update is available on 8aPDF."
        val channel = if (type == "test") NotificationSupport.TEST_CHANNEL else NotificationSupport.CONTENT_CHANNEL
        NotificationSupport.show(this, channel, title, body, data["destination"] ?: "home")
    }
}
