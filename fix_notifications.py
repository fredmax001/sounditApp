import re

with open('api/notifications.py', 'r') as f:
    content = f.read()

# Fix 1: Replace the broken push notification block
old_block = '''                if data.send_in_app:
                    create_notification(
                        db=db,
                        user_id=uid,
                        title=notif_title,
                        message=notif_message,
                        notification_type="event_update",
                        data={
                            "entity_type": "event" if data.event_id else "organizer",
                            "entity_id": data.event_id or organizer_id,
                            "event_id": data.event_id,
                            "organizer_name": organizer_name
                        }
                    )
                    notifications_created += 1
                elif data.send_push:
                    # Send push only (no in-app notification)
                    push_service = PushService(db)
                    temp_notif = Notification(
                        user_id=uid,
                        title=notif_title,
                        message=notif_message,
                        type="event_update",
                        data={
                            "entity_type": "event" if data.event_id else "organizer",
                            "entity_id": data.event_id or organizer_id,
                            "event_id": data.event_id,
                            "organizer_name": organizer_name
                        }
                    )
                    push_service.send_notification(temp_notif)
                    pushes_sent += 1
                    create_notification(
                        db=db,
                        user_id=uid,
                        title=notif_title,
                        message=notif_message,
                        notification_type="event_update",
                        data={
                            "entity_type": "event" if data.event_id else "organizer",
                            "entity_id": data.event_id or organizer_id,
                            "event_id": data.event_id,
                            "organizer_name": organizer_name
                        }
                    )
                    notifications_created += 1
                elif data.send_push:
                    # Send push only (no in-app notification)
                    push_service = PushService(db)
                    push_service.send_notification_to_user(
                        user_id=uid,
                        title=notif_title,
                        message=notif_message,
                        data={
                            "entity_type": "event" if data.event_id else "organizer",
                            "entity_id": data.event_id or organizer_id,
                            "event_id": data.event_id,
                            "organizer_name": organizer_name
                        }
                    )
                    pushes_sent += 1'''

new_block = '''                if data.send_in_app:
                    create_notification(
                        db=db,
                        user_id=uid,
                        title=notif_title,
                        message=notif_message,
                        notification_type="event_update",
                        data={
                            "entity_type": "event" if data.event_id else "organizer",
                            "entity_id": data.event_id or organizer_id,
                            "event_id": data.event_id,
                            "organizer_name": organizer_name
                        }
                    )
                    notifications_created += 1

                if data.send_push:
                    push_service = PushService(db)
                    push_service.send_notification_to_user(
                        user_id=uid,
                        title=notif_title,
                        message=notif_message,
                        data={
                            "entity_type": "event" if data.event_id else "organizer",
                            "entity_id": data.event_id or organizer_id,
                            "event_id": data.event_id,
                            "organizer_name": organizer_name
                        }
                    )
                    pushes_sent += 1'''

if old_block in content:
    content = content.replace(old_block, new_block)
    print("Fixed broadcast notification block")
else:
    print("WARNING: Could not find old broadcast block")

with open('api/notifications.py', 'w') as f:
    f.write(content)

print("Done")
